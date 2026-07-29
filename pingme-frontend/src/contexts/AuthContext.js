import React, { createContext, useContext, useState, useCallback } from "react";
import { API_BASE } from "../constants";
import { supabase, isSupabaseConfigured } from "../supabaseClient";

const AuthContext = createContext(null);

// Extract a readable error message from both {message} and {errors:[{msg}]} shapes
const extractError = (data, fallback) =>
    data?.message ||
    (Array.isArray(data?.errors) && data.errors.length > 0 ? data.errors[0].msg : null) ||
    fallback;

/**
 * Fetch with automatic retry, AbortController timeouts, and exponential backoff.
 * Retries only on network errors or fetch timeouts, not on HTTP error status codes.
 * @param {string} url
 * @param {RequestInit} options
 * @param {object} retryOpts
 * @param {number} retryOpts.maxAttempts - Total attempts (default 8)
 * @param {number} retryOpts.timeoutMs - Timeout per request attempt in ms (default 8000)
 * @param {number} retryOpts.baseDelayMs - Initial retry delay ms (default 1500)
 * @param {Function} retryOpts.onRetry - Called with (attempt, statusMsg) on each retry
 */
const fetchWithRetry = async (
    url,
    options = {},
    { maxAttempts = 8, timeoutMs = 8000, baseDelayMs = 1500, onRetry } = {}
) => {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timer);
            return res; // any HTTP response (even 4xx/5xx) — caller handles
        } catch (err) {
            clearTimeout(timer);
            lastErr = err;
            if (attempt === maxAttempts) break;
            const isAbort = err.name === "AbortError";
            const delay = Math.min(baseDelayMs * attempt, 4000);
            const statusMsg = `Waking up backend server… attempt ${attempt}/${maxAttempts} (${isAbort ? "connecting" : "retrying"})`;
            console.warn(`[fetchWithRetry] ${statusMsg}:`, err.message);
            if (onRetry) onRetry(attempt, statusMsg);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
};

/**
 * wakeupBackend — hits /api/ping with retries to wake a sleeping Render instance.
 * Resolves as soon as the server responds (even if 1st attempt fails).
 * @param {Function} [onStatus] - Called with a status string on each retry
 */
const wakeupBackend = async (onStatus) => {
    const pingUrl = `${API_BASE}/ping`;
    for (let i = 1; i <= 6; i++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
            const res = await fetch(pingUrl, { method: "GET", signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
                console.log(`[wakeupBackend] Server is awake (attempt ${i})`);
                return true;
            }
        } catch (_) {
            clearTimeout(timer);
            // network error or timeout — server still waking
        }
        if (i < 6) {
            const msg = `Server is starting up… (${i}/6)`;
            console.warn("[wakeupBackend]", msg);
            if (onStatus) onStatus(msg);
            await new Promise((r) => setTimeout(r, 1500));
        }
    }
    // Give up silently — the real request will retry with fetchWithRetry
    return false;
};

// In-memory cache of verified Supabase access tokens by phone number
// If backend exchange fails on attempt 1, retrying will re-use this token instead of re-calling Supabase verifyOtp (which fails as OTP consumed)
const verifiedSupabaseSessions = new Map();

export const AuthProvider = ({ children }) => {

    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const saved = localStorage.getItem("chatapp_user");
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [token, setToken] = useState(() => localStorage.getItem("chatapp_token") || null);

    /**
     * sendOtp — pre-warms the backend, then sends SMS OTP via Supabase.
     * @param {string} phone - E.164 formatted phone number
     * @param {Function} [onWarmupStatus] - Called with status string during server warm-up
     */
    const sendOtp = useCallback(async (phone, onWarmupStatus) => {
        if (!isSupabaseConfigured) {
            throw new Error("Supabase is not configured. Please add your credentials to the .env file.");
        }
        const cleanPhone = phone.trim();
        // Clear any old session token cache for this number when requesting a fresh OTP
        verifiedSupabaseSessions.delete(cleanPhone);

        // Pre-warm the backend in parallel/background so it wakes up
        wakeupBackend(onWarmupStatus).catch(() => {});

        console.log(`[sendOtp] Requesting SMS OTP from Supabase for: ${cleanPhone}`);
        const { data, error } = await supabase.auth.signInWithOtp({
            phone: cleanPhone,
            options: {
                shouldCreateUser: true,
            },
        });

        if (error) {
            console.error("[sendOtp] Supabase SMS error details:", error);
            let userFriendlyMsg = error.message || "Failed to send SMS code.";
            if (error.status === 429 || userFriendlyMsg.toLowerCase().includes("rate limit")) {
                userFriendlyMsg = "SMS rate limit reached. Please wait 60 seconds before requesting another code.";
            } else if (userFriendlyMsg.toLowerCase().includes("twilio") || userFriendlyMsg.toLowerCase().includes("provider")) {
                userFriendlyMsg = "Twilio SMS Error: Please check Twilio Verified Caller IDs & Geo-Permissions in Supabase Dashboard.";
            }
            throw new Error(userFriendlyMsg);
        }
        console.log("[sendOtp] Supabase SMS OTP dispatch successful:", data);
        return data;
    }, []);

    /**
     * verifyOtp — verifies SMS OTP with Supabase then exchanges the session for a backend JWT.
     * Caches session tokens so retrying connection never fails due to consumed/expired OTPs.
     * @param {string} phone
     * @param {string} code
     * @param {Function} [onRetryStatus] - Called with a human-readable status string on each retry
     */
    const verifyOtp = useCallback(async (phone, code, onRetryStatus) => {
        const cleanPhone = phone.trim();
        let accessToken = verifiedSupabaseSessions.get(cleanPhone);

        // 1. If we don't have a cached session from an earlier attempt, verify with Supabase
        if (!accessToken) {
            const { data, error } = await supabase.auth.verifyOtp({
                phone: cleanPhone,
                token: code.trim(),
                type: "sms",
            });
            if (error) {
                console.error("[verifyOtp] Supabase OTP verification failed:", error);
                let msg = error.message || "Invalid verification code.";
                if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("token")) {
                    msg = "The verification code entered is incorrect or expired. Please enter the code received via SMS or click 'Resend Code'.";
                }
                throw new Error(msg);
            }

            const session = data.session;
            if (!session || !session.access_token) {
                throw new Error("No session returned from Supabase authentication.");
            }
            accessToken = session.access_token;
            // Cache session token in case backend exchange needs retry
            verifiedSupabaseSessions.set(cleanPhone, accessToken);
        } else {
            console.log("[verifyOtp] Using cached verified Supabase session for backend exchange...");
        }

        // 2. Exchange Supabase token for backend JWT — with fallback to direct Supabase session if Render is hibernating
        let resData = null;
        try {
            const res = await fetchWithRetry(
                `${API_BASE}/auth/supabase-login`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: accessToken, phone: cleanPhone }),
                },
                {
                    maxAttempts: 3,
                    timeoutMs: 3000,
                    baseDelayMs: 600,
                    onRetry: (attempt) => {
                        if (onRetryStatus) onRetryStatus(`Connecting to server… (${attempt}/3)`);
                    },
                }
            );
            if (res && res.ok) {
                resData = await res.json().catch(() => null);
            }
        } catch (fetchErr) {
            console.warn("[verifyOtp] Backend server is asleep/initializing. Utilizing verified Supabase session fallback...");
        }

        // If backend server is awake -> use backend JWT & DB user
        // If backend server is hibernating on Render -> construct session from verified Supabase token (Zero user delay!)
        if (!resData || !resData.token) {
            const normalizedPhone = cleanPhone.replace(/\D/g, "");
            const fallbackHash = Math.abs(cleanPhone.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0));
            const fallbackUser = {
                id: fallbackHash || Date.now(),
                username: `+${normalizedPhone}@user`,
                email: `+${normalizedPhone}@phone.supabase`,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalizedPhone}`,
                phone: cleanPhone
            };
            resData = {
                token: accessToken,
                user: fallbackUser,
                isNewUser: false
            };
        }

        // Success! Clear session cache
        verifiedSupabaseSessions.delete(cleanPhone);

        localStorage.setItem("chatapp_token", resData.token);
        localStorage.setItem("chatapp_user", JSON.stringify(resData.user));
        setToken(resData.token);
        setCurrentUser(resData.user);
        return resData;
    }, []);

    const login = useCallback(async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(extractError(resData, "Login failed"));

        localStorage.setItem("chatapp_token", resData.token);
        localStorage.setItem("chatapp_user", JSON.stringify(resData.user));
        setToken(resData.token);
        setCurrentUser(resData.user);
        return resData;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("chatapp_token");
        localStorage.removeItem("chatapp_user");
        setToken(null);
        setCurrentUser(null);
    }, []);

    const authFetch = useCallback(
        (url, options = {}) => {
            const headers = {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            };

            // Don't set Content-Type if body is FormData (let browser set it with boundary)
            if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
                headers["Content-Type"] = "application/json";
            }

            return fetch(url, {
                ...options,
                headers,
            });
        },
        [token]
    );

    // Atomically update currentUser in both React state and localStorage
    const updateCurrentUser = useCallback((userData) => {
        const merged = { ...currentUser, ...userData };
        localStorage.setItem("chatapp_user", JSON.stringify(merged));
        setCurrentUser(merged);
    }, [currentUser]);

    // Re-fetch the latest user profile from the server and sync it
    const refreshUser = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            localStorage.setItem("chatapp_user", JSON.stringify({ ...currentUser, ...data }));
            setCurrentUser(prev => ({ ...prev, ...data }));
        } catch (err) {
            console.error("[refreshUser] Failed:", err.message);
        }
    }, [token, currentUser]);

    return (
        <AuthContext.Provider value={{ currentUser, token, sendOtp, verifyOtp, login, logout, authFetch, isAuthenticated: !!token, updateCurrentUser, refreshUser, wakeupBackend }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
