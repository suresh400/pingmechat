import React, { createContext, useContext, useState, useCallback } from "react";
import { API_BASE } from "../constants";

const AuthContext = createContext(null);

// Extract a readable error message from both {message} and {errors:[{msg}]} shapes
const extractError = (data, fallback) =>
    data?.message ||
    (Array.isArray(data?.errors) && data.errors.length > 0 ? data.errors[0].msg : null) ||
    fallback;

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

    const login = useCallback(async (email, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(extractError(data, "Login failed"));
        localStorage.setItem("chatapp_token", data.token);
        localStorage.setItem("chatapp_user", JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
        return data;
    }, []);

    const register = useCallback(async (username, email, password, otp) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password, otp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(extractError(data, "Registration failed"));
        if (data.otpRequired) {
            return data;
        }
        localStorage.setItem("chatapp_token", data.token);
        localStorage.setItem("chatapp_user", JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
        return data;
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
        <AuthContext.Provider value={{ currentUser, token, login, logout, register, authFetch, isAuthenticated: !!token, updateCurrentUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
