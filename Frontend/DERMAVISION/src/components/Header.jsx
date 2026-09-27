import React, { useState } from "react";
import { HiMenu, HiX } from "react-icons/hi";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  const navLinks = [
    { name: "Home", href: "/home" },
    { name: "Skin Analysis", href: "/analysis" },
    { name: "Technology", href: "#technology" },
    { name: "How it Works", href: "#how-it-works" },
    { name: "Dermatologists", href: "#dermatologists" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8DFD8] z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/home" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-[#DC926E] to-[#E8A585] flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
            DV
          </div>
          <span className="text-xl font-bold tracking-tight text-[#2B2623]">
            Derma<span className="text-[#DC926E] font-normal">Vision</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#5A524C]">
          {navLinks.map((link) => (
            link.href.startsWith("#") ? (
              <a
                key={link.name}
                href={link.href}
                className="hover:text-[#DC926E] transition-colors duration-200"
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                to={link.href}
                className="hover:text-[#DC926E] transition-colors duration-200"
              >
                {link.name}
              </Link>
            )
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#46352F] bg-[#FAF1EC] border border-[#EFCAAD] px-3 py-1.5 rounded-full">
                👋 {user?.name || "User"}
              </span>
              <button
                onClick={logout}
                className="text-sm font-medium text-[#7A7069] hover:text-[#DC926E] px-3 py-1.5 transition-colors border border-transparent hover:border-[#E8DFD8] rounded-md cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-[#5A524C] hover:text-[#DC926E] px-4 py-2 transition-colors border border-transparent hover:border-[#E8DFD8] rounded-md"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-[#DC926E] hover:bg-[#c87e5b] text-white text-sm font-medium px-5 py-2.5 rounded-md shadow-sm transition-all duration-200"
              >
                Register Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-2xl text-[#2B2623] p-1 rounded-md border border-[#E8DFD8]"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle Navigation"
        >
          {menuOpen ? <HiX /> : <HiMenu />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-[#FAF8F5] border-b border-[#E8DFD8] px-6 py-6 space-y-4">
          <nav className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              link.href.startsWith("#") ? (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-[#5A524C] font-medium py-1 hover:text-[#DC926E] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-[#5A524C] font-medium py-1 hover:text-[#DC926E] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.name}
                </Link>
              )
            ))}
          </nav>
          <div className="pt-4 border-t border-[#E8DFD8] flex flex-col gap-3">
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[#46352F] text-center bg-[#FAF1EC] border border-[#EFCAAD] py-2 rounded-md">
                  Signed in as: {user?.name || "User"}
                </span>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="w-full text-center font-medium text-red-600 py-2 border border-red-200 rounded-md hover:bg-red-50 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-center font-medium text-[#5A524C] py-2 border border-[#E8DFD8] rounded-md"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-[#DC926E] text-white text-center font-medium py-2.5 rounded-md"
                  onClick={() => setMenuOpen(false)}
                >
                  Register Account
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;