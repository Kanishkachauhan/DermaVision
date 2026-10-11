import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DermatologistMap from '../components/DermatologistMap';
import { HiOutlineSparkles, HiOutlineShieldCheck, HiOutlineLocationMarker, HiArrowRight } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

const FindDermatologists = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', {
        replace: true,
        state: { from: '/dermatologists', message: 'Please log in to find nearby dermatologists.' }
      });
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#FAF8F5] via-[#FFF6F0] to-[#FAF8F5] border border-[#E8DFD8] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#DC926E]/15 border border-[#DC926E]/30 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold text-[#DC926E] uppercase tracking-wider">
            <HiOutlineLocationMarker className="text-sm shrink-0" />
            <span>OpenStreetMap Healthcare Directory</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#2B2623] tracking-tight leading-tight">
            Find Dermatologists &amp; Clinics Near You
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-[#7A7069] leading-relaxed">
            Locate certified skin specialists, dermatology clinics, and healthcare centers in your vicinity.
            Powered exclusively by free community data from OpenStreetMap.
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 sm:pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A524C]">
              <HiOutlineShieldCheck className="text-base text-emerald-600 shrink-0" />
              <span>100% Free &amp; Private</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A524C]">
              <span className="text-sm">📍</span>
              <span>GPS Geolocation</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A524C]">
              <span className="text-sm">🗺️</span>
              <span>OpenStreetMap Routing</span>
            </div>
          </div>
        </div>

        {/* Decorative graphic in background */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden md:flex items-center justify-center">
          <span className="text-9xl">🩺</span>
        </div>
      </div>

      {/* Main Map Component */}
      <div className="space-y-4">
        <DermatologistMap />
      </div>

      {/* Skincare CTA Banner */}
      <div className="bg-white border border-[#E8DFD8] rounded-2xl p-5 sm:p-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6 shadow-sm">
        <div className="space-y-1.5 text-left">
          <h3 className="text-base sm:text-lg font-bold text-[#2B2623]">
            Haven't analyzed your skin yet?
          </h3>
          <p className="text-xs sm:text-sm text-[#7A7069] max-w-xl">
            Run an AI skin analysis first to detect concerns like acne, pores, and dark circles.
            Take your report to your consultation for a more informed doctor visit.
          </p>
        </div>
        <Link
          to="/analysis"
          className="inline-flex items-center justify-center gap-2 bg-[#2B2623] hover:bg-black text-white text-xs sm:text-sm font-bold px-5 sm:px-6 py-3 rounded-xl shadow-sm transition-all flex-shrink-0 text-center"
        >
          <HiOutlineSparkles className="text-sm text-[#DC926E]" />
          <span>Start AI Skin Analysis</span>
          <HiArrowRight />
        </Link>
      </div>
    </div>
  );
};

export default FindDermatologists;
