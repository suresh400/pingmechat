import React, { useState } from "react";
import Router from "./routes";
import ThemeProvider from "./theme";
import ThemeSettings from "./components/settings";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import SplashScreen from "./components/SplashScreen";

function App() {
  // Only show splash on first-ever visit; returning users (who have a token) skip it
  const isReturningUser = !!localStorage.getItem("chatapp_token");
  const [showSplash, setShowSplash] = useState(!isReturningUser);

  return (
    <AuthProvider>
      <SocketProvider>
        <ThemeProvider>
          <ThemeSettings>
            {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
            <Router />
          </ThemeSettings>
        </ThemeProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
