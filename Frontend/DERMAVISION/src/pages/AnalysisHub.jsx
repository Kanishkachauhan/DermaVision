import React from "react";
import { Link } from "react-router-dom";
import { HiOutlineArrowLeft, HiArrowRight, HiOutlineEye, HiOutlineSparkles } from "react-icons/hi";

const AnalysisHub = () => {
  const modes = [
    {
      to: "/analysis/dark-circles",
      icon: "👁️",
      title: "Dark Circle Analysis",
      subtitle: "Periorbital melanin & vascular scan",
      description:
        "Detects under-eye dark circles using MediaPipe periorbital landmark isolation. Measures ΔL* luminance, melanin index, and tear-trough vascular pooling.",
      tags: ["Periorbital", "ΔL* Colorimetry", "Vascular"],
      color: "#DC926E",
      bg: "#FAF1EC",
    },
    {
      to: "/analysis/acne-pores",
      icon: "🔬",
      title: "Acne & Pore Analysis",
      subtitle: "Texture-variance lesion & pore dilation scan",
      description:
        "Maps acne lesions (comedones, papules, pustules) and pore dilation across 5 facial zones — forehead, cheeks, nose, and chin — using luminance variance ML.",
      tags: ["T-Zone", "Texture Variance", "Pore RMS"],
      color: "#7C5CFC",
      bg: "#F3F0FF",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF9] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="w-9 h-9 rounded-full bg-white border border-[#E8DFD8] text-[#5A524C] hover:text-[#DC926E] flex items-center justify-center transition-colors shadow-sm"
          >
            <HiOutlineArrowLeft className="text-lg" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#2B2623] tracking-tight">
              AI Skin Analysis Hub
            </h1>
            <p className="text-xs text-[#7A7069]">
              Select a diagnostic scan mode to begin
            </p>
          </div>
        </div>

        {/* Mode Cards */}
        <div className="grid gap-5">
          {modes.map((mode) => (
            <Link
              key={mode.to}
              to={mode.to}
              className="group bg-white border border-[#E8DFD8] rounded-2xl p-6 hover:border-[#DC926E]/60 hover:shadow-md transition-all flex gap-5 items-start"
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm"
                style={{ backgroundColor: mode.bg }}
              >
                {mode.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black text-[#2B2623]">{mode.title}</h2>
                    <p className="text-xs font-semibold" style={{ color: mode.color }}>
                      {mode.subtitle}
                    </p>
                  </div>
                  <HiArrowRight
                    className="text-[#7A7069] group-hover:text-[#DC926E] group-hover:translate-x-1 transition-all shrink-0 mt-0.5"
                  />
                </div>

                <p className="text-xs text-[#7A7069] mt-2 leading-relaxed">{mode.description}</p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {mode.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                      style={{ backgroundColor: mode.bg, color: mode.color }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#A09890]">
          All analysis runs locally in your browser — no image data is ever uploaded without your consent.
        </p>
      </div>
    </div>
  );
};

export default AnalysisHub;
