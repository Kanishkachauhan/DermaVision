// src/context/AuthContext.jsx
import React, { createContext, useContext, useState } from "react";
import { apiRequest } from "../utils/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("dermavision_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("dermavision_token") || null;
  });

  const [loading, setLoading] = useState(false);

  // Login
  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (data.accessToken && data.user) {
        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem("dermavision_token", data.accessToken);
        localStorage.setItem("dermavision_user", JSON.stringify(data.user));
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  // Register
  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      // Auto-verify with devOtp if present in development
      if (data.devOtp) {
        await apiRequest("/auth/verify-otp", {
          method: "POST",
          body: JSON.stringify({ email, otp: data.devOtp }),
        }).catch(() => {});
      }

      return data;
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOtp = async (email, otp) => {
    setLoading(true);
    try {
      const data = await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("dermavision_token");
    localStorage.removeItem("dermavision_user");
    apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        verifyOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
