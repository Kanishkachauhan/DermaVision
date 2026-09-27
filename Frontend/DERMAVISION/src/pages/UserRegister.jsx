import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Registergirl from '../assets/registergirl.jpg';
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const UserRegister = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div className="min-h-screen bg-[#F3CAB6] flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-6xl min-h-162.5 bg-[#EFCAAD] rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row">

        {/* Left Side - Image */}
        <div
          className="relative lg:w-1/2 min-h-87.5 lg:min-h-full bg-cover bg-center"
          style={{
            backgroundImage: `url(${Registergirl})`,
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-[#DC926E]/60 via-transparent to-transparent"></div>

          {/* Logo */}
          <div className="absolute top-8 left-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              DermaVision
            </h1>
          </div>

          {/* Bottom Text */}
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <p className="text-3xl md:text-4xl font-semibold">
              Your Skin,
              <br />
              Our Priority.
            </p>

            <p className="mt-3 text-sm md:text-base max-w-sm">
              Discover your skin better with intelligent analysis
              and personalized skincare recommendations.
            </p>
          </div>
        </div>

        {/* Right Side - Sign Up Card */}
        <div className="lg:w-1/2 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 sm:p-10 md:p-14">

          <div className="w-full max-w-md">

            {/* Heading */}
            <div className="text-center mb-8">
              <p className="text-sm uppercase tracking-[0.25em] text-[#DC926E] font-semibold">
                Create Your Account
              </p>

              <h2 className="text-4xl md:text-5xl font-bold text-[#46352F] mt-2">
                Sign Up
              </h2>

              <p className="text-gray-500 mt-3">
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

              <button
                type="button"
                onClick={() => navigate("/home")}
                className="w-full border border-[#EFCAAD] bg-white hover:bg-[#FFF5F0] py-3 rounded-xl flex items-center justify-center gap-3 text-[#46352F] font-medium transition cursor-pointer"
              >
                <span className="font-bold text-lg"><FcGoogle />
</span>
                Continue with Google
              </button>

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