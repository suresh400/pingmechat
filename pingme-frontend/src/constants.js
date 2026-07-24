// Backend URL configuration
// In development: uses .env.development → REACT_APP_BACKEND_URL=http://localhost:5000
// In production:  uses https://pingme-backend.onrender.com
const getBackendUrl = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  const isBrowser = typeof window !== "undefined" && window.location && window.location.hostname;
  const isLocalhost = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // If in browser on a production domain, strictly ensure HTTPS production backend URL
  if (isBrowser && !isLocalhost) {
    if (envUrl && !envUrl.includes("localhost")) {
      return envUrl.replace(/\/$/, "");
    }
    return "https://pingme-backend.onrender.com";
  }

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  return "http://localhost:5000";
};

export const BASE_URL = getBackendUrl();
export const API_BASE = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;
