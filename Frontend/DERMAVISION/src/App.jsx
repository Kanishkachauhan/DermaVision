import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import UserRegister from "./pages/UserRegister";
import Home from "./pages/Home";
import SkinAnalysis from "./pages/SkinAnalysis";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { AuthProvider } from "./context/AuthContext";

const MainLayout = ({ children }) => (
  <div className="min-h-screen bg-[#FAF8F5] text-[#2B2623] font-sans flex flex-col justify-between selection:bg-[#DC926E]/20 selection:text-[#DC926E]">
    <Header />
    <main className="flex-grow pt-20">{children}</main>
    <Footer />
  </div>
);

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<MainLayout><Home /></MainLayout>} />
        <Route path="/home"          element={<MainLayout><Home /></MainLayout>} />
        <Route path="/analysis"      element={<MainLayout><SkinAnalysis /></MainLayout>} />
        <Route path="/skin-analysis" element={<MainLayout><SkinAnalysis /></MainLayout>} />
        <Route path="/login"         element={<Login />} />
        <Route path="/register"      element={<UserRegister />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
