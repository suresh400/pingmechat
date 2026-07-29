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
 * Fetch with automatic retry and exponential backoff.
 * Retries only on network errors (no response), not on HTTP error status codes.
 * @param {string} url
 * @param {RequestInit} options
 * @param {object} retryOpts
 * @param {number} retryOpts.maxAttempts - Total attempts (default 5)
 * @param {number} retryOpts.baseDelayMs - Initial retry delay ms (default 2000)
 * @param {Function} retryOpts.onRetry - Called with (attempt, delayMs) on each retry
 */
const fetchWithRetry = async (url, options = {}, { maxAttempts = 5, baseDelayMs = 2000, onRetry } = {}) => {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await fetch(url, options);
            return res; // any HTTP response (even 4xx/5xx) — caller handles
        } catch (err) {
            lastErr = err;
            if (attempt === maxAttempts) break;
            const delay = baseDelayMs * attempt; // 2s, 4s, 6s, 8s
            console.warn(`[fetchWithRetry] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms…`, err.message);
            if (onRetry) onRetry(attempt, delay);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
};

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

    const sendOtp = useCallback(async (phone) => {
        if (!isSupabaseConfigured) {
            throw new Error("Supabase is not configured. Please add your credentials to the .env file.");
        }
        const { data, error } = await supabase.auth.signInWithOtp({
            phone: phone.trim(),
        });
        if (error) throw error;
        return data;
    }, []);

    /**
     * verifyOtp — verifies SMS OTP with Supabase then exchanges the session for a backend JWT.
     * @param {string} phone
     * @param {string} code
     * @param {Function} [onRetryStatus] - Called with a human-readable status string on each retry
     */
    const verifyOtp = useCallback(async (phone, code, onRetryStatus) => {
        // 1. Verify with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
            phone: phone.trim(),
            token: code.trim(),
            type: "sms",
        });
        if (error) throw error;

        const session = data.session;
        if (!session) throw new Error("No session returned from Supabase authentication.");

        // 2. Exchange Supabase token for backend JWT — with retry for Render cold-starts
        let res;
        try {
            res = await fetchWithRetry(
                `${API_BASE}/auth/supabase-login`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: session.access_token, phone: phone.trim() }),
                },
                {
                    maxAttempts: 5,
                    baseDelayMs: 2000,
                    onRetry: (attempt, delayMs) => {
                        const msg = `Server is warming up… retrying (${attempt}/4). Please wait.`;
                        console.warn("[verifyOtp]", msg);
                        if (onRetryStatus) onRetryStatus(msg);
                    },
                }
            );
        } catch (fetchErr) {
            console.error("[verifyOtp] All retry attempts failed:", fetchErr);
            throw new Error(
                "Cannot reach the authentication server after multiple attempts. " +
                "The server may be temporarily unavailable. Please wait 30 seconds and try again."
            );
        }

        const resData = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractError(resData, "Authentication exchange failed"));

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
        <AuthContext.Provider value={{ currentUser, token, sendOtp, verifyOtp, login, logout, authFetch, isAuthenticated: !!token, updateCurrentUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
