import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import UserRegister from "./pages/UserRegister";
import Home from "./pages/Home";
import SkinAnalysis from "./pages/SkinAnalysis";
import FindDermatologists from "./pages/FindDermatologists";
import Products from "./pages/Products";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useLocation } from "react-router-dom";

const MainLayout = ({ children }) => (
  <div className="min-h-screen bg-[#FAF8F5] text-[#2B2623] font-sans flex flex-col justify-between selection:bg-[#DC926E]/20 selection:text-[#DC926E]">
    <Header />
    <main className="flex-grow pt-16 sm:pt-20">{children}</main>
    <Footer />
  </div>
);

// ProtectedRoute: Redirects unauthenticated users to /login
const ProtectedRoute = ({ children, message }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="w-10 h-10 border-4 border-[#DC926E] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const defaultMsg = location.pathname.includes("dermatologist")
      ? "Please log in to find nearby dermatologists."
      : "Please log in to access AI Skin Analysis.";

    return (
      <Navigate
        to="/login"
        state={{ from: location, message: message || defaultMsg }}
        replace
      />
    );
  }

  return children;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"                    element={<MainLayout><Home /></MainLayout>} />
        <Route path="/home"                element={<MainLayout><Home /></MainLayout>} />
        <Route path="/products"            element={<MainLayout><Products /></MainLayout>} />
        <Route path="/product"             element={<Navigate to="/products" replace />} />
        <Route
          path="/analysis"
          element={
            <ProtectedRoute message="Please log in to access AI Skin Analysis.">
              <MainLayout>
                <SkinAnalysis />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/analysis/*"          element={<Navigate to="/analysis" replace />} />
        <Route
          path="/skin-analysis"
          element={
            <ProtectedRoute message="Please log in to access AI Skin Analysis.">
              <MainLayout>
                <SkinAnalysis />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dermatologists"
          element={
            <ProtectedRoute message="Please log in to find nearby dermatologists.">
              <MainLayout>
                <FindDermatologists />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/find-dermatologists"
          element={
            <ProtectedRoute message="Please log in to find nearby dermatologists.">
              <MainLayout>
                <FindDermatologists />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/login"               element={<Login />} />
        <Route path="/register"            element={<UserRegister />} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
