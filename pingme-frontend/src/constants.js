// Backend URL configuration
// In development: uses .env.development → REACT_APP_BACKEND_URL=http://localhost:5000
// In production:  set REACT_APP_BACKEND_URL in Vercel dashboard
// Fallback is always localhost:5000 to ensure local dev always works
export const BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
export const API_BASE = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;
