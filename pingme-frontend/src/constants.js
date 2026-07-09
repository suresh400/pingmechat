// Backend URL configuration
// In development: uses .env.development → REACT_APP_BACKEND_URL=http://localhost:5000
// In production:  set REACT_APP_BACKEND_URL in Vercel dashboard
// Fallback is always localhost:5000 to ensure local dev always works
const getBackendUrl = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl) return envUrl;

  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:5000`;
    }
  }
  return "http://localhost:5000";
};

export const BASE_URL = getBackendUrl();
export const API_BASE = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;
