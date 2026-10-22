import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Registergirl from '../assets/registergirl.jpg';
import { FaApple } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../utils/api";

const UserRegister = () => {
  const navigate = useNavigate();
  const { register, googleLogin } = useAuth();

  const googleButtonRef = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleConfigLoading, setGoogleConfigLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiRequest("/auth/google/client-id")
      .then((data) => {
        if (!cancelled) setGoogleClientId(data.clientId || "");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Google sign-up is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setGoogleConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;

    let cancelled = false;
    const scriptId = "google-identity-services";
    let script = document.getElementById(scriptId);
    let resizeObserver;
    const initializeGoogleSignIn = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setLoading(true);
          setError("");
          try {
            await googleLogin(credential);
            navigate("/home", { replace: true });
          } catch (err) {
            setError(err.message || "Google sign-up failed. Please try again.");
          } finally {
            setLoading(false);
          }
        },
      });

      let lastWidth = 0;
      const renderGoogleButton = () => {
        const width = Math.min(400, Math.floor(googleButtonRef.current?.clientWidth || 0));
        if (!width || width === lastWidth || cancelled) return;

        lastWidth = width;
        googleButtonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signup_with",
          shape: "rectangular",
          width,
        });
      };

      resizeObserver = new ResizeObserver(renderGoogleButton);
      resizeObserver.observe(googleButtonRef.current);
      renderGoogleButton();
    };
    const handleScriptError = () => {
      if (!cancelled) setError("Google sign-in could not load. Please try again later.");
    };

    if (window.google?.accounts?.id) {
      initializeGoogleSignIn();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
      }

      script.addEventListener("load", initializeGoogleSignIn);
      script.addEventListener("error", handleScriptError);
      if (!script.isConnected) document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", initializeGoogleSignIn);
      script?.removeEventListener("error", handleScriptError);
      resizeObserver?.disconnect();
    };
  }, [googleClientId, googleLogin, navigate]);

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await register(name, email, password);
      navigate("/login");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F3CAB6] flex items-center justify-center p-3 sm:p-6 md:p-8">

      <div className="w-full max-w-6xl bg-[#EFCAAD] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row my-auto">

        {/* Left Side - Image */}
        <div
          className="relative lg:w-1/2 min-h-[200px] sm:min-h-[280px] lg:min-h-[640px] bg-cover bg-center"
          style={{
            backgroundImage: `url(${Registergirl})`,
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-[#DC926E]/70 via-[#46352F]/20 to-transparent"></div>

          {/* Logo */}
          <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
              DermaVision
            </h1>
          </div>

          {/* Bottom Text */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-8 text-white">
            <p className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight">
              Your Skin,
              <span className="sm:hidden"> </span>
              <br className="hidden sm:inline" />
              Our Priority.
            </p>

            <p className="hidden sm:block mt-2 sm:mt-3 text-xs sm:text-base max-w-sm text-white/90">
              Discover your skin better with intelligent analysis
              and personalized skincare recommendations.
            </p>
          </div>
        </div>

        {/* Right Side - Sign Up Card */}
        <div className="lg:w-1/2 bg-white/95 backdrop-blur-sm flex items-center justify-center p-5 sm:p-10 md:p-14">

          <div className="w-full max-w-md">

            {/* Heading */}
            <div className="text-center mb-6 sm:mb-8">
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#DC926E] font-semibold">
                Create Your Account
              </p>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#46352F] mt-1 sm:mt-2">
                Sign Up
              </h2>

              <p className="text-gray-500 text-xs sm:text-sm mt-2 sm:mt-3">
                Start your journey towards healthier,
                glowing skin.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-5">

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[#46352F] mb-2">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#EFCAAD] bg-[#FFF9F6] outline-none focus:border-[#DC926E] focus:ring-2 focus:ring-[#F3CAB6] transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#46352F] mb-2">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#EFCAAD] bg-[#FFF9F6] outline-none focus:border-[#DC926E] focus:ring-2 focus:ring-[#F3CAB6] transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-[#46352F] mb-2">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full px-4 py-3.5 rounded-xl border border-[#EFCAAD] bg-[#FFF9F6] outline-none focus:border-[#DC926E] focus:ring-2 focus:ring-[#F3CAB6] transition"
                />
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#DC926E] hover:bg-[#c97e59] text-white font-semibold py-3.5 rounded-xl transition duration-300 shadow-md hover:shadow-lg cursor-pointer disabled:opacity-75"
              >
                {loading ? "Registering..." : "Register →"}
              </button>

            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-7">
              <div className="flex-1 h-px bg-[#EFCAAD]"></div>

              <span className="text-sm text-gray-400">
                OR
              </span>

              <div className="flex-1 h-px bg-[#EFCAAD]"></div>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-3">

              {googleClientId ? (
                <div
                  ref={googleButtonRef}
                  className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-[#EFCAAD] bg-white py-3 text-[#46352F] transition hover:bg-[#FFF5F0]"
                  aria-label="Sign up with Google"
                />
              ) : googleConfigLoading ? (
                <p className="text-center text-xs text-gray-500">
                  Loading Google sign-up…
                </p>
              ) : (
                <p className="text-center text-xs text-gray-500">
                  Google sign-up is unavailable until it is configured.
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate("/home")}
                className="w-full border border-[#EFCAAD] bg-white hover:bg-[#FFF5F0] py-3 rounded-xl flex items-center justify-center gap-3 text-[#46352F] font-medium transition cursor-pointer"
              >
                <span className="font-bold text-lg"><FaApple /></span>
                Continue with Apple
              </button>

            </div>

            {/* Login */}
            <p className="text-center text-sm text-gray-500 mt-7">
              Already have an account?
              <Link
                to="/login"
                className="ml-1 text-[#DC926E] font-semibold hover:underline"
              >
                Login
              </Link>
            </p>


          </div>
        </div>

      </div>
    </div>
  );
};

export default UserRegister;