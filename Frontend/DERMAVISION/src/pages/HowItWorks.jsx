import React from "react";
import { Link } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineCamera,
  HiOutlineSparkles,
  HiOutlineDocumentReport,
  HiOutlineLocationMarker,
  HiOutlineCheckCircle,
  HiOutlineLightBulb,
} from "react-icons/hi";

// Visual step images
import registerGirlImg from "../assets/registergirl.jpg";
import scanUiImg from "../assets/dermavision_scan_ui_1789367756914.jpg";
import aiTelemetryImg from "../assets/dermavision_ai_telemetry_1789367830219.jpg";
import clinicalSuiteImg from "../assets/dermavision_clinical_suite_1789367799745.jpg";

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      badge: "Step 1",
      title: "Take or Upload a Photo",
      shortDesc: "Snap a quick selfie with your phone camera or upload an existing photo.",
      details: "Use good natural lighting and look straight at the camera. No makeup or filters needed.",
      img: registerGirlImg,
      alt: "User taking a clear facial photo",
      icon: <HiOutlineCamera className="text-lg text-[#DC926E]" />,
      highlights: ["Front-facing selfie", "Natural lighting", "Takes 5 seconds"],
    },
    {
      number: "02",
      badge: "Step 2",
      title: "Instant Smart Scan",
      shortDesc: "Our smart system scans your face in real-time right in your browser.",
      details: "It checks key skin areas to spot common concerns like acne, redness, pores, and dark circles.",
      img: scanUiImg,
      alt: "Smart facial skin scanning preview",
      icon: <HiOutlineSparkles className="text-lg text-[#DC926E]" />,
      highlights: ["Acne & pore check", "Redness detection", "Dark circles score"],
    },
    {
      number: "03",
      badge: "Step 3",
      title: "View Results & Routine",
      shortDesc: "Get an easy-to-read skin summary and simple daily care recommendations.",
      details: "See your overall skin score, what concerns were found, and a gentle morning and evening routine.",
      img: aiTelemetryImg,
      alt: "Skin health report and skincare routine",
      icon: <HiOutlineDocumentReport className="text-lg text-[#DC926E]" />,
      highlights: ["Clear skin score", "Morning & night routine", "Downloadable report"],
    },
    {
      number: "04",
      badge: "Step 4",
      title: "Connect with a Doctor",
      shortDesc: "Find verified skin clinics and dermatologists near your location.",
      details: "If you need clinical care, view nearby doctors on the map and bring your report to the visit.",
      img: clinicalSuiteImg,
      alt: "Nearby dermatologist clinic locator",
      icon: <HiOutlineLocationMarker className="text-lg text-[#DC926E]" />,
      highlights: ["Nearby doctor map", "Free clinic search", "Easy to share report"],
    },
  ];

  const tips = [
    {
      title: "Natural Light",
      desc: "Face a window or sit in a brightly lit room to avoid harsh shadows.",
    },
    {
      title: "Clean Face",
      desc: "Wash face and remove makeup or filters for the most accurate scan.",
    },
    {
      title: "Straight Angle",
      desc: "Hold your phone at eye level so your whole face is visible.",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-12 sm:space-y-16">
      
      {/* ─── HERO HEADER ─── */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF1EC] border border-[#EFCAAD] text-xs font-bold text-[#C46D46] uppercase tracking-wider">
          <HiOutlineSparkles className="text-sm shrink-0" />
          <span>Simple 4-Step Process</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2B2623] tracking-tight">
          How <span className="text-[#DC926E]">DermaVision</span> Works
        </h1>

        <p className="text-sm sm:text-base text-[#6B615B] leading-relaxed max-w-2xl mx-auto">
          Get clear insights into your skin health in four easy steps — from taking a quick photo to viewing your personalized skincare advice.
        </p>
      </section>

      {/* ─── PICTURE FLOWCHART (VISUAL FLOW OVERVIEW) ─── */}
      <section className="bg-white border border-[#E8DFD8] rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm">
        <div className="text-center mb-6 sm:mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-[#DC926E] bg-[#FAF1EC] border border-[#EFCAAD] px-3 py-1 rounded-full">
            Visual Flowchart
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-[#2B2623] mt-2">
            The Complete User Flow at a Glance
          </h2>
          <p className="text-xs sm:text-sm text-[#7A7069] mt-1">
            Follow the journey from image upload to personalized skin guidance
          </p>
        </div>

        {/* Desktop / Tablet Flowchart: Horizontal Pipeline with Pictures and Arrows */}
        <div className="hidden md:grid md:grid-cols-4 gap-4 relative">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative flex flex-col items-center text-center group">
              
              {/* Image Thumbnail Container */}
              <div className="w-full h-36 rounded-xl overflow-hidden border-2 border-[#E8DFD8] group-hover:border-[#DC926E] transition-all duration-300 relative bg-[#FAF8F5] shadow-xs">
                <img
                  src={step.img}
                  alt={step.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                
                {/* Step badge overlay */}
                <div className="absolute top-2 left-2 bg-[#DC926E] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                  {step.badge}
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[11px] font-medium">
                  <span className="truncate">{step.title}</span>
                </div>
              </div>

              {/* Connecting Arrow for items 1-3 */}
              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute top-18 -right-3.5 z-10 w-7 h-7 rounded-full bg-[#FAF8F5] border border-[#DC926E]/40 items-center justify-center text-[#DC926E] shadow-xs">
                  <HiArrowRight className="text-xs" />
                </div>
              )}

              {/* Text Description under thumbnail */}
              <div className="mt-3.5 space-y-1">
                <h3 className="text-sm font-bold text-[#2B2623]">
                  {step.title}
                </h3>
                <p className="text-xs text-[#7A7069] line-clamp-2 leading-relaxed">
                  {step.shortDesc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Flowchart: Vertical Connected Timeline with Pictures */}
        <div className="md:hidden space-y-4">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex flex-col items-center">
              <div className="w-full bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl p-3 flex items-center gap-3">
                <img
                  src={step.img}
                  alt={step.alt}
                  className="w-20 h-20 rounded-lg object-cover shrink-0 border border-[#E8DFD8]"
                />
                <div className="space-y-1 text-left min-w-0">
                  <span className="text-[10px] font-bold text-[#DC926E] uppercase bg-[#FAF1EC] px-2 py-0.5 rounded">
                    {step.badge}
                  </span>
                  <h3 className="text-sm font-bold text-[#2B2623] truncate">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#7A7069] leading-snug line-clamp-2">
                    {step.shortDesc}
                  </p>
                </div>
              </div>

              {/* Vertical connector line */}
              {idx < steps.length - 1 && (
                <div className="w-0.5 h-6 bg-[#DC926E]/40 my-1 relative flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#DC926E]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── DETAILED 4 STEPS WITH PICTURES ─── */}
      <section className="space-y-6 sm:space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B2623]">
            Step-by-Step Walkthrough
          </h2>
          <p className="text-xs sm:text-sm text-[#7A7069]">
            Everything happens quickly and securely right from your device.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-[#E8DFD8] rounded-2xl overflow-hidden shadow-sm hover:border-[#DC926E]/50 transition-all duration-300 flex flex-col"
            >
              {/* Picture Preview */}
              <div className="relative h-48 sm:h-56 bg-[#FAF8F5] overflow-hidden">
                <img
                  src={step.img}
                  alt={step.alt}
                  className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Floating Step Number & Icon */}
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full border border-white/40 shadow-xs flex items-center gap-1.5">
                  {step.icon}
                  <span className="text-xs font-bold text-[#2B2623]">{step.badge}</span>
                </div>

                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <span className="text-xs font-medium text-white/80 uppercase tracking-wider block">
                    Phase {step.number}
                  </span>
                  <span className="text-base sm:text-lg font-bold">{step.title}</span>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-5 sm:p-6 space-y-4 flex-grow flex flex-col justify-between">
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm text-[#5A524C] leading-relaxed">
                    {step.details}
                  </p>
                </div>

                {/* Quick Highlights Pills */}
                <div className="pt-3 border-t border-[#F0EAE5] flex flex-wrap gap-2">
                  {step.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#FAF8F5] border border-[#E8DFD8] text-[#5A524C] px-2.5 py-1 rounded-md"
                    >
                      <HiOutlineCheckCircle className="text-emerald-600 text-xs shrink-0" />
                      <span>{h}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── QUICK TIPS FOR ACCURATE SCANS ─── */}
      <section className="bg-[#FAF1EC] border border-[#EFCAAD] rounded-2xl sm:rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-[#DC926E] text-white flex items-center justify-center shrink-0 shadow-xs">
            <HiOutlineLightBulb className="text-lg" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#2B2623]">
              3 Simple Tips for the Best Results
            </h3>
            <p className="text-xs text-[#7A7069]">
              Following these easy tips helps the camera read your skin accurately.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tips.map((tip, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#EACFC2] rounded-xl p-4 space-y-1.5 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#DC926E]/15 text-[#DC926E] text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <h4 className="text-sm font-bold text-[#2B2623]">{tip.title}</h4>
              </div>
              <p className="text-xs text-[#6B615B] leading-relaxed">
                {tip.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CALL TO ACTION BANNER ─── */}
      <section className="bg-white border border-[#E8DFD8] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm text-center max-w-3xl mx-auto space-y-5">
        <h3 className="text-xl sm:text-2xl font-extrabold text-[#2B2623]">
          Ready to Check Your Skin?
        </h3>
        <p className="text-xs sm:text-sm text-[#7A7069] max-w-lg mx-auto">
          Start your quick scan now and see your personalized skin report in less than a minute.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/analysis"
            className="w-full sm:w-auto bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs sm:text-sm font-semibold px-6 py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <span>Start Free Skin Analysis</span>
            <HiArrowRight />
          </Link>

          <Link
            to="/dermatologists"
            className="w-full sm:w-auto bg-[#FAF8F5] hover:bg-[#F5EBE6] text-[#4A423D] border border-[#E8DFD8] text-xs sm:text-sm font-semibold px-5 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <HiOutlineLocationMarker className="text-[#DC926E] text-sm" />
            <span>Find Nearby Doctors</span>
          </Link>
        </div>
      </section>

    </div>
  );
};

export default HowItWorks;

