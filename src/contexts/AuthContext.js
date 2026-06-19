import React, { createContext, useContext, useState, useCallback } from "react";
import { API_BASE } from "../constants";

const AuthContext = createContext(null);

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
        if (!res.ok) throw new Error(data.message || "Login failed");
        localStorage.setItem("chatapp_token", data.token);
        localStorage.setItem("chatapp_user", JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
        return data;
    }, []);

    const register = useCallback(async (username, email, password) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Registration failed");
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

    return (
        <AuthContext.Provider value={{ currentUser, token, login, logout, register, authFetch, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
