import React from "react";
import { Link, useNavigate } from "react-router-dom";


import girlImage from "../assets/registergirl.jpg";

const Login = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F3CAB6] flex items-center justify-center p-4">

      {/* Main Container */}
      <div className="w-full max-w-6xl min-h-162.5 bg-[#EFCAAD] rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row">

        {/* Left Section */}
        <div className="lg:w-1/2 relative min-h-87.5 lg:min-h-162.5 overflow-hidden">

          {/* Background Image */}
          <img
            src={girlImage}
            alt="Skincare"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Image Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-[#46352F]/70 via-[#DC926E]/20 to-transparent"></div>

          {/* Logo */}
          <div className="absolute top-8 left-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              DermaVision
            </h1>

            <p className="text-white/80 text-sm mt-1">
              Smart skincare. Better skin.
            </p>
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-8 left-8 right-8 text-white">

            <p className="text-sm uppercase tracking-[0.3em] mb-3">
              Your Skin Journey
            </p>

            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Your skin
              <br />
              deserves the best.
            </h2>

            <p className="mt-4 text-white/85 max-w-md leading-6">
              Continue your skincare journey with personalized
              insights, recommendations and expert guidance.
            </p>

          </div>
        </div>

        {/* Right Login Section */}
        <div className="lg:w-1/2 bg-white flex items-center justify-center px-6 py-12 sm:px-10 md:px-16">

          <div className="w-full max-w-md">

            {/* Heading */}
            <div className="text-center mb-10">

              <p className="text-sm uppercase tracking-[0.25em] text-[#DC926E] font-semibold">
                Welcome Back
              </p>

              <h2 className="text-4xl md:text-5xl font-bold text-[#46352F] mt-2">
                Login
              </h2>

              <p className="text-gray-500 mt-3">
                Login to continue your personalized skincare journey.
              </p>

            </div>

            {/* Form */}
            <div className="space-y-6">

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-[#46352F] mb-2">
                  Email Address
                </label>

                <input
                  type="email"
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
                type="button"
                onClick={() => navigate("/home")}
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
                hover:-translate-y-0.5"
              >
                Login →
              </button>

            </div>

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