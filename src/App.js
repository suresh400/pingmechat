import React, { useState } from "react";
import Router from "./routes";
import ThemeProvider from "./theme";
import ThemeSettings from "./components/settings";
import { AuthProvider } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import SplashScreen from "./components/SplashScreen";

function App() {
  const [showSplash, setShowSplash] = useState(true);

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
