import React, { useState, useEffect } from "react";
import { HiMenu, HiX } from "react-icons/hi";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navLinks = [
    { name: "Home", href: "/home" },
    { name: "Skin Analysis", href: "/analysis" },
    { name: "Technology", href: "#technology" },
    { name: "How it Works", href: "#how-it-works" },
    { name: "Dermatologists", href: "/dermatologists" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 w-full bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8DFD8] z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/home" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-gradient-to-tr from-[#DC926E] to-[#E8A585] flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm group-hover:scale-105 transition-transform">
              DV
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-[#2B2623]">
              Derma<span className="text-[#DC926E] font-normal">Vision</span>
            </span>
          </Link>

          {/* Desktop Navigation - active on lg screens (1024px+) to prevent tablet wrap */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium text-[#5A524C]">
            {navLinks.map((link) => (
              link.href.startsWith("#") ? (
                <a
                  key={link.name}
                  href={link.href}
                  className="hover:text-[#DC926E] transition-colors duration-200 py-1"
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className="hover:text-[#DC926E] transition-colors duration-200 py-1"
                >
                  {link.name}
                </Link>
              )
            ))}
          </nav>

          {/* Action Buttons - Desktop */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <span className="text-xs sm:text-sm font-medium text-[#46352F] bg-[#FAF1EC] border border-[#EFCAAD] px-3 py-1.5 rounded-full truncate max-w-[160px]">
                  👋 {user?.name || "User"}
                </span>
                <button
                  onClick={logout}
                  className="text-xs sm:text-sm font-medium text-[#7A7069] hover:text-[#DC926E] px-3 py-1.5 transition-colors border border-transparent hover:border-[#E8DFD8] rounded-md cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-[#5A524C] hover:text-[#DC926E] px-3.5 py-2 transition-colors border border-transparent hover:border-[#E8DFD8] rounded-md"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-[#DC926E] hover:bg-[#c87e5b] text-white text-sm font-medium px-4 py-2.5 rounded-md shadow-sm transition-all duration-200"
                >
                  Register Account
                </Link>
              </>
            )}
          </div>

          {/* Mobile & Tablet Menu Toggle Button */}
          <div className="flex items-center gap-2 lg:hidden">
            {isAuthenticated && (
              <span className="text-xs font-semibold text-[#46352F] bg-[#FAF1EC] border border-[#EFCAAD] px-2.5 py-1 rounded-full truncate max-w-[110px] sm:max-w-[150px]">
                {user?.name || "User"}
              </span>
            )}
            <button
              className="text-2xl text-[#2B2623] p-1.5 rounded-lg border border-[#E8DFD8] hover:bg-[#F5EBE6] transition-colors cursor-pointer"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle Navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <HiX /> : <HiMenu />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Menu Dropdown */}
        {menuOpen && (
          <div className="lg:hidden bg-[#FAF8F5] border-b border-[#E8DFD8] px-5 sm:px-8 py-5 space-y-4 max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-5rem)] overflow-y-auto shadow-xl">
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                link.href.startsWith("#") ? (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-[#5A524C] hover:text-[#DC926E] hover:bg-[#F5EBE6]/60 font-medium px-3 py-2.5 rounded-lg transition-colors text-sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-[#5A524C] hover:text-[#DC926E] hover:bg-[#F5EBE6]/60 font-medium px-3 py-2.5 rounded-lg transition-colors text-sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                )
              ))}
            </nav>

            <div className="pt-3 border-t border-[#E8DFD8] flex flex-col gap-2.5">
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs sm:text-sm font-medium text-[#46352F] text-center bg-[#FAF1EC] border border-[#EFCAAD] py-2 px-3 rounded-lg">
                    Signed in as: <strong>{user?.name || "User"}</strong>
                  </span>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-center font-medium text-red-600 py-2.5 border border-red-200 rounded-lg hover:bg-red-50 text-sm cursor-pointer transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    to="/login"
                    className="text-center font-medium text-[#5A524C] py-2.5 border border-[#E8DFD8] rounded-lg hover:bg-[#F5EBE6] text-sm transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-[#DC926E] hover:bg-[#c87e5b] text-white text-center font-medium py-2.5 rounded-lg shadow-sm text-sm transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Backdrop overlay on mobile when menu is open */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden top-16 sm:top-20"
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default Header;