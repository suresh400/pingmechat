import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { SOCKET_URL } from "../constants";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { currentUser, isAuthenticated } = useAuth();
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (isAuthenticated && currentUser?.id) {
            const s = io(SOCKET_URL, {
                auth: { userId: currentUser.id },
            });
            socketRef.current = s;
            setSocket(s);

            return () => {
                s.disconnect();
                socketRef.current = null;
                setSocket(null);
            };
        }
    }, [isAuthenticated, currentUser?.id]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
