import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import girlImage from "../assets/registergirl.jpg";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const redirectMessage = location.state?.message || "";
  const destination = location.state?.from?.pathname || location.state?.from || "/home";

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Failed to login. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F3CAB6] flex items-center justify-center p-3 sm:p-6 md:p-8">

      {/* Main Container */}
      <div className="w-full max-w-6xl bg-[#EFCAAD] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row my-auto">

        {/* Left Section */}
        <div className="lg:w-1/2 relative min-h-[200px] sm:min-h-[280px] lg:min-h-[620px] overflow-hidden">

          {/* Background Image */}
          <img
            src={girlImage}
            alt="Skincare"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Image Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-[#46352F]/75 via-[#DC926E]/20 to-transparent"></div>

          {/* Logo */}
          <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
              DermaVision
            </h1>

            <p className="text-white/80 text-xs sm:text-sm mt-0.5 sm:mt-1">
              Smart skincare. Better skin.
            </p>
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-8 text-white">

            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-1 sm:mb-3 text-[#FAF1EC]">
              Your Skin Journey
            </p>

            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight">
              Your skin
              <span className="sm:hidden"> </span>
              <br className="hidden sm:inline" />
              deserves the best.
            </h2>

            <p className="hidden sm:block mt-2 sm:mt-4 text-white/85 max-w-md text-xs sm:text-sm leading-relaxed">
              Continue your skincare journey with personalized
              insights, recommendations and expert guidance.
            </p>

          </div>
        </div>

        {/* Right Login Section */}
        <div className="lg:w-1/2 bg-white flex items-center justify-center px-5 py-8 sm:px-10 md:px-16">

          <div className="w-full max-w-md">

            {/* Heading */}
            <div className="text-center mb-6 sm:mb-10">

              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#DC926E] font-semibold">
                Welcome Back
              </p>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#46352F] mt-1 sm:mt-2">
                Login
              </h2>

              <p className="text-gray-500 text-xs sm:text-sm mt-2 sm:mt-3">
                Login to continue your personalized skincare journey.
              </p>

            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-6">

              {redirectMessage && !error && (
                <div className="text-xs text-[#DC926E] bg-[#FAF1EC] border border-[#DC926E]/40 px-4 py-3 rounded-xl font-semibold flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <span>{redirectMessage}</span>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-[#46352F] mb-2">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-4 rounded-xl
                  border border-[#EFCAAD]
                  bg-[#FFF9F6]
                  text-[#46352F]
                  placeholder-gray-400
                  outline-none
                  focus:border-[#DC926E]
                  focus:ring-2
                  focus:ring-[#F3CAB6]
                  transition duration-300"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-[#46352F] mb-2">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-4 rounded-xl
                  border border-[#EFCAAD]
                  bg-[#FFF9F6]
                  text-[#46352F]
                  placeholder-gray-400
                  outline-none
                  focus:border-[#DC926E]
                  focus:ring-2
                  focus:ring-[#F3CAB6]
                  transition duration-300"
                />
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <a
                  href="#"
                  className="text-sm text-[#DC926E] font-medium hover:underline"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#DC926E]
                hover:bg-[#C97D58]
                text-white
                font-semibold
                py-4
                rounded-xl
                shadow-md
                hover:shadow-lg
                transition-all
                duration-300
                hover:-translate-y-0.5
                cursor-pointer disabled:opacity-75"
              >
                {loading ? "Logging in..." : "Login →"}
              </button>

            </form>

            {/* Register Option */}
            <div className="text-center mt-8">

              <p className="text-sm text-gray-500">
                Don't have an account?

                <Link
                  to="/register"
                  className="ml-1 text-[#DC926E] font-semibold hover:underline"
                >
                  Register
                </Link>
              </p>

            </div>

            {/* Bottom Quote */}
            <div className="text-center mt-8">

              <p className="text-sm text-gray-400">
                Healthy skin starts with
                <span className="text-[#DC926E] font-semibold ml-1">
                  understanding it.
                </span>
              </p>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;