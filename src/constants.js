const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// For ngrok, we want to use the current origin as the base URL
// The React dev server proxy will forward requests to localhost:5000
export const BASE_URL = isLocal ? "http://localhost:5000" : window.location.origin;
export const API_BASE = `${BASE_URL}/api`;
export const SOCKET_URL = BASE_URL;
