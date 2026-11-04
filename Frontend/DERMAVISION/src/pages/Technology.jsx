import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineHeart,
  HiOutlineLightBulb,
  HiOutlineColorSwatch,
  HiOutlineAdjustments,
  HiOutlineUserGroup,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineRefresh,
} from "react-icons/hi";

// Visual step images
import scanUiImg from "../assets/dermavision_scan_ui_1789367756914.jpg";
import macroSkinImg from "../assets/dermavision_macro_skin_1789367779537.jpg";
import aiTelemetryImg from "../assets/dermavision_ai_telemetry_1789367830219.jpg";
import clinicalSuiteImg from "../assets/dermavision_clinical_suite_1789367799745.jpg";

const Technology = () => {
  const [activeTab, setActiveTab] = useState("analysis");
  const [activeSpotlight, setActiveSpotlight] = useState(0);

  // Interactive Spotlights for Scanner Inspector
  const scanSpotlights = [
    {
      title: "Cheeks & Sensitivity",
      badge: "Redness Reader",
      color: "from-rose-500/20 to-rose-500/5",
      borderColor: "border-rose-400",
      textColor: "text-rose-700",
      bgBadge: "bg-rose-50",
      simpleExplanation:
        "Measures subtle temperature and flush tones on your cheeks to identify skin reactivity and environmental irritation without guesswork.",
      whatItLooksFor: ["Vascular warmth & redness", "Dry irritation spots", "Barrier sensitivity"],
      suggestedCare: "Gentle soothing serums with Centella, Aloe, and Ceramide barrier creams.",
    },
    {
      title: "T-Zone & Forehead",
      badge: "Pore & Oil Balance",
      color: "from-amber-500/20 to-amber-500/5",
      borderColor: "border-amber-400",
      textColor: "text-amber-800",
      bgBadge: "bg-amber-50",
      simpleExplanation:
        "Analyzes surface shine and pore density across your forehead and nose bridge to balance oil production without stripping your skin.",
      whatItLooksFor: ["Enlarged pores", "Excess surface shine", "Micro-texture smoothness"],
      suggestedCare: "Lightweight balancing toners, Niacinamide, and oil-free gel moisturizers.",
    },
    {
      title: "Under-Eye Area",
      badge: "Radiance & Fatigue",
      color: "from-indigo-500/20 to-indigo-500/5",
      borderColor: "border-indigo-400",
      textColor: "text-indigo-700",
      bgBadge: "bg-indigo-50",
      simpleExplanation:
        "Inspects light-reflection and delicate pigmentation under the eyes to highlight fatigue, shadows, and dehydration lines.",
      whatItLooksFor: ["Dark under-eye circles", "Delicate skin dehydration", "Puffiness markers"],
      suggestedCare: "Caffeine-infused brightening eye gels and peptide hydration boosters.",
    },
    {
      title: "Chin & Jawline",
      badge: "Blemish & Acne Scan",
      color: "from-emerald-500/20 to-emerald-500/5",
      borderColor: "border-emerald-400",
      textColor: "text-emerald-700",
      bgBadge: "bg-emerald-50",
      simpleExplanation:
        "Scans for active bumps, blocked comedones, and spots to recommend non-irritating, breakout-clearing ingredients.",
      whatItLooksFor: ["Active bumps & breakouts", "Blackheads & whiteheads", "Post-blemish recovery"],
      suggestedCare: "Gentle Salicylic acid wash, spot treatments, and soothing non-comedogenic care.",
    },
  ];

  // Product Matching logic cards (plain English)
  const productMatchingRules = [
    {
      concern: "If Redness or Sensitivity is Spotted",
      tag: "Calming Match",
      rule: "We filter out harsh scrubs, artificial fragrances, and intense acids.",
      heroIngredients: ["Centella Asiatica", "Oat Extract", "Ceramides"],
      outcome: "Soothes skin barrier and restores an even, calm skin tone.",
    },
    {
      concern: "If Clogged Pores or Blemishes Occur",
      tag: "Clarifying Match",
      rule: "We choose gentle pore-clearing actives that unclog without peeling.",
      heroIngredients: ["Salicylic Acid (BHA)", "Zinc PCA", "Tea Tree"],
      outcome: "Reduces congestion and smooths texture within weeks.",
    },
    {
      concern: "If Dehydration or Dullness Appears",
      tag: "Hydration Match",
      rule: "We pair moisture-locking ingredients with lightweight water-based layers.",
      heroIngredients: ["Hyaluronic Acid", "Glycerin", "Vitamin C"],
      outcome: "Bounces back skin radiance and keeps moisture locked all day.",
    },
  ];

  // Dermatologist recommendation flow
  const dermatSteps = [
    {
      number: "01",
      title: "Automated Concern Severity Check",
      desc: "Our engine reviews whether your scan is a mild cosmetic routine need or needs a certified doctor’s eye (such as severe cysts or rash).",
    },
    {
      number: "02",
      title: "Instant Nearby Clinic Matching",
      desc: "Using your location, we locate verified dermatology practices within your city with contact details and directions ready.",
    },
    {
      number: "03",
      title: "One-Click Clinical Summary PDF",
      desc: "You can download a clean, structured summary of your facial metrics and photos to bring directly to your consultation.",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-14 space-y-14 sm:space-y-20">
      
      {/* ─── HERO HEADER ─── */}
      <section className="text-center max-w-3xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF1EC] border border-[#EFCAAD] text-xs font-bold text-[#C46D46] uppercase tracking-wider shadow-xs">
          <HiOutlineSparkles className="text-sm shrink-0" />
          <span>Intelligent Care • Made Simple</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2B2623] tracking-tight leading-tight">
          The Science Behind <span className="text-[#DC926E]">DermaVision</span>
        </h1>

        <p className="text-sm sm:text-base text-[#6B615B] leading-relaxed max-w-2xl mx-auto">
          Explore how our smart camera scan, gentle skincare matching, and dermatologist network work together to give you confident, glowing skin — no complex medical jargon required.
        </p>

        {/* Tab Switcher Pills */}
        <div className="pt-4 flex flex-wrap justify-center gap-2 sm:gap-3">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-xs ${
              activeTab === "analysis"
                ? "bg-[#DC926E] text-white shadow-md shadow-[#DC926E]/20 scale-102"
                : "bg-white text-[#5A524C] hover:bg-[#F5EBE6] border border-[#E8DFD8]"
            }`}
          >
            <HiOutlineEye className="text-base" />
            <span>1. Smart Face Scan</span>
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-xs ${
              activeTab === "products"
                ? "bg-[#DC926E] text-white shadow-md shadow-[#DC926E]/20 scale-102"
                : "bg-white text-[#5A524C] hover:bg-[#F5EBE6] border border-[#E8DFD8]"
            }`}
          >
            <HiOutlineColorSwatch className="text-base" />
            <span>2. Skincare Recommendation</span>
          </button>

          <button
            onClick={() => setActiveTab("dermatologists")}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-xs ${
              activeTab === "dermatologists"
                ? "bg-[#DC926E] text-white shadow-md shadow-[#DC926E]/20 scale-102"
                : "bg-white text-[#5A524C] hover:bg-[#F5EBE6] border border-[#E8DFD8]"
            }`}
          >
            <HiOutlineUserGroup className="text-base" />
            <span>3. Doctor Network</span>
          </button>
        </div>
      </section>

      {/* ─── TAB 1: HOW FACIAL ANALYSIS WORKS ─── */}
      {activeTab === "analysis" && (
        <div className="space-y-12 animate-fadeIn">
          
          {/* Main Visual Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-[#E8DFD8] rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DC926E] uppercase tracking-wider bg-[#FAF1EC] px-3 py-1 rounded-full">
                <HiOutlineAdjustments className="text-sm" />
                <span>Camera Vision Pipeline</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B2623] leading-snug">
                How Your Camera Reads Your Skin in Seconds
              </h2>
              <p className="text-sm text-[#6B615B] leading-relaxed">
                When you snap a selfie, DermaVision doesn’t just look at a flat picture. It creates a subtle 3D contour of your face, mapping hundreds of natural reference points to inspect tone, texture, and spots in their exact zones.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <HiOutlineCheckCircle className="text-sm" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">Zero Clutter Mapping</h4>
                    <p className="text-xs text-[#7A7069]">Separates hair, background, and shadows so only your real skin is analyzed.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <HiOutlineCheckCircle className="text-sm" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">True-to-Life Color Reading</h4>
                    <p className="text-xs text-[#7A7069]">Calibrates lighting variations to measure redness and pigmentation honestly.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <HiOutlineCheckCircle className="text-sm" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">Private &amp; Secure Processing</h4>
                    <p className="text-xs text-[#7A7069]">Runs lightning-fast right in your browser. Your selfie is never sold or made public.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Screen Card */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#E8DFD8] shadow-md group">
                <img
                  src={scanUiImg}
                  alt="DermaVision Face Scanner UI"
                  className="w-full h-80 sm:h-96 object-cover object-center group-hover:scale-103 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                {/* Floating telemetry pills */}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-[#2B2623]">Real-time Mesh: 468 Points Active</span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-white/80 uppercase font-semibold">Live Skin Metric</p>
                      <p className="text-sm font-bold">Skin Clarity Score: 88% Healthy</p>
                    </div>
                    <span className="text-xs font-semibold bg-[#DC926E] text-white px-2.5 py-1 rounded-md">Calibrated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Scanner Inspector */}
          <section className="bg-[#FAF8F5] border border-[#E8DFD8] rounded-3xl p-6 sm:p-10 space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#DC926E] bg-[#FAF1EC] px-3 py-1 rounded-full border border-[#EFCAAD]">
                Interactive Inspector
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#2B2623]">
                What Our Scanner Checks Across Your Face
              </h3>
              <p className="text-xs sm:text-sm text-[#7A7069]">
                Click on any zone below to see how our engine analyzes it and what it means for your routine.
              </p>
            </div>

            {/* Zone Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {scanSpotlights.map((spot, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSpotlight(idx)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    activeSpotlight === idx
                      ? "bg-white border-[#DC926E] shadow-sm ring-2 ring-[#DC926E]/20"
                      : "bg-white/60 hover:bg-white border-[#E8DFD8]"
                  }`}
                >
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md w-fit mb-2 ${spot.bgBadge} ${spot.textColor}`}>
                    {spot.badge}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[#2B2623]">
                    {spot.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Zone Detail Display Card */}
            <div className="bg-white border border-[#E8DFD8] rounded-2xl p-5 sm:p-7 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-5 relative rounded-xl overflow-hidden h-52 sm:h-60 border border-[#E8DFD8]">
                <img
                  src={macroSkinImg}
                  alt="Macro Skin Analysis"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <span className="text-white text-xs font-semibold bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-md">
                    Micro-Focus Zone: {scanSpotlights[activeSpotlight].title}
                  </span>
                </div>
              </div>

              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${scanSpotlights[activeSpotlight].bgBadge} ${scanSpotlights[activeSpotlight].textColor}`}>
                    {scanSpotlights[activeSpotlight].badge}
                  </span>
                  <h4 className="text-lg font-bold text-[#2B2623]">
                    {scanSpotlights[activeSpotlight].title} Analysis
                  </h4>
                </div>

                <p className="text-xs sm:text-sm text-[#5A524C] leading-relaxed">
                  {scanSpotlights[activeSpotlight].simpleExplanation}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-[#FAF8F5] border border-[#E8DFD8] p-3 rounded-xl">
                    <p className="text-[11px] font-bold text-[#7A7069] uppercase mb-1.5">What We Look For</p>
                    <ul className="space-y-1 text-xs text-[#2B2623]">
                      {scanSpotlights[activeSpotlight].whatItLooksFor.map((item, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#DC926E]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#FAF1EC] border border-[#EFCAAD] p-3 rounded-xl">
                    <p className="text-[11px] font-bold text-[#C46D46] uppercase mb-1.5">Gentle Care Solution</p>
                    <p className="text-xs text-[#46352F] leading-snug">
                      {scanSpotlights[activeSpotlight].suggestedCare}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </section>

        </div>
      )}

      {/* ─── TAB 2: PRODUCT RECOMMENDATION LOGIC ─── */}
      {activeTab === "products" && (
        <div className="space-y-12 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-[#E8DFD8] rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DC926E] uppercase tracking-wider bg-[#FAF1EC] px-3 py-1 rounded-full">
                <HiOutlineColorSwatch className="text-sm" />
                <span>The Skincare Matchmaker</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B2623] leading-snug">
                How We Pick the Right Products For You
              </h2>
              <p className="text-sm text-[#6B615B] leading-relaxed">
                Skincare shouldn’t be a guessing game where you buy 10 different serums hoping one works. Our matchmaker takes the exact score from your scan and selects formulas with clinically proven active ingredients that suit your skin type.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#DC926E]/15 text-[#DC926E] flex items-center justify-center font-bold text-xs shrink-0">
                    01
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">Target Primary Concern First</h4>
                    <p className="text-xs text-[#7A7069]">Whether it's calming a redness flare-up or clearing congestion, we address what your skin needs right now.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#DC926E]/15 text-[#DC926E] flex items-center justify-center font-bold text-xs shrink-0">
                    02
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">Safety &amp; Irritation Guard</h4>
                    <p className="text-xs text-[#7A7069]">Sensitive skin profiles automatically exclude strong alcohol, sulfates, and heavy synthetic perfumes.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#DC926E]/15 text-[#DC926E] flex items-center justify-center font-bold text-xs shrink-0">
                    03
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">Morning vs. Evening Routine</h4>
                    <p className="text-xs text-[#7A7069]">Morning focuses on lightweight protection &amp; SPF; evening focuses on hydration &amp; barrier recovery.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Telemetry Card */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#E8DFD8] shadow-md group">
                <img
                  src={aiTelemetryImg}
                  alt="DermaVision AI Telemetry and Routine Builder"
                  className="w-full h-80 sm:h-96 object-cover object-center group-hover:scale-103 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm flex items-center gap-2">
                  <HiOutlineSparkles className="text-[#DC926E]" />
                  <span className="text-xs font-bold text-[#2B2623]">Ingredient Synergy Verified</span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white space-y-2">
                  <div className="bg-black/50 backdrop-blur-md rounded-xl p-3.5 border border-white/20">
                    <p className="text-[11px] text-[#EFCAAD] font-semibold uppercase">Routine Sample Generated</p>
                    <p className="text-xs sm:text-sm font-bold">Gentle Cleanser + Niacinamide + Ceramide Barrier Gel</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Real-Life Matching Scenarios */}
          <div className="space-y-4">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold text-[#2B2623]">
                Examples of How We Match Your Skin
              </h3>
              <p className="text-xs sm:text-sm text-[#7A7069]">
                See how different scan findings translate into simple, healthy ingredients.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {productMatchingRules.map((card, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-[#E8DFD8] rounded-2xl p-5 sm:p-6 shadow-sm hover:border-[#DC926E] transition-all duration-300 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FAF1EC] border border-[#EFCAAD] text-[#C46D46] px-2.5 py-1 rounded-full">
                      {card.tag}
                    </span>
                    <h4 className="text-base font-bold text-[#2B2623]">
                      {card.concern}
                    </h4>
                    <p className="text-xs text-[#6B615B] leading-relaxed">
                      {card.rule}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[#F0EAE5]">
                    <div>
                      <p className="text-[10px] font-bold text-[#7A7069] uppercase mb-1">Key Hero Ingredients</p>
                      <div className="flex flex-wrap gap-1.5">
                        {card.heroIngredients.map((ing, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-medium bg-[#FAF8F5] text-[#2B2623] border border-[#E8DFD8] px-2 py-0.5 rounded-md"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200/60 p-2.5 rounded-xl">
                      <p className="text-[11px] font-semibold text-emerald-800">
                        ✨ Expected Result: {card.outcome}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ─── TAB 3: DOCTOR RECOMMENDATION & CLINICAL BRIDGE ─── */}
      {activeTab === "dermatologists" && (
        <div className="space-y-12 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white border border-[#E8DFD8] rounded-3xl p-6 sm:p-10 shadow-sm">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DC926E] uppercase tracking-wider bg-[#FAF1EC] px-3 py-1 rounded-full">
                <HiOutlineUserGroup className="text-sm" />
                <span>Medical Bridge</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B2623] leading-snug">
                When Skincare Isn't Enough, We Connect You to Doctors
              </h2>
              <p className="text-sm text-[#6B615B] leading-relaxed">
                DermaVision knows the boundary between daily skincare and clinical dermatology. If your scan identifies signs of deep cystic breakouts, persistent redness, or suspicious spots, we immediately help you connect with certified specialists nearby.
              </p>

              <div className="space-y-3 pt-2">
                {dermatSteps.map((step) => (
                  <div
                    key={step.number}
                    className="flex items-start gap-3 p-3.5 bg-[#FAF8F5] border border-[#E8DFD8] rounded-xl"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#DC926E] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {step.number}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#2B2623]">
                        {step.title}
                      </h4>
                      <p className="text-xs text-[#7A7069] leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Clinical Suite Card */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#E8DFD8] shadow-md group">
                <img
                  src={clinicalSuiteImg}
                  alt="DermaVision Clinical Suite and Dermatologist Network"
                  className="w-full h-80 sm:h-96 object-cover object-center group-hover:scale-103 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm flex items-center gap-2">
                  <HiOutlineShieldCheck className="text-emerald-600 text-base" />
                  <span className="text-xs font-bold text-[#2B2623]">Board-Certified Doctor Network</span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="bg-black/50 backdrop-blur-md rounded-xl p-3.5 border border-white/20 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-[#EFCAAD] font-semibold uppercase">Clinical Report Ready</p>
                      <p className="text-xs sm:text-sm font-bold">Comprehensive PDF export with 9 telemetry markers</p>
                    </div>
                    <Link
                      to="/dermatologists"
                      className="text-xs bg-[#DC926E] hover:bg-[#c87e5b] text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View Clinics
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ─── VISUAL COMPARISON: GUESSING VS. DERMAVISION ─── */}
      <section className="bg-white border border-[#E8DFD8] rounded-3xl p-6 sm:p-10 shadow-sm">
        <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-[#DC926E] bg-[#FAF1EC] border border-[#EFCAAD] px-3 py-1 rounded-full">
            The Difference
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#2B2623]">
            Guesswork vs. Precision Care
          </h3>
          <p className="text-xs sm:text-sm text-[#7A7069]">
            Why intelligent scanning saves your skin time, money, and frustration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Old Way */}
          <div className="bg-[#FAF8F5] border border-red-200/60 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <span className="text-lg">❌</span>
              <h4 className="text-base font-bold text-[#2B2623]">Traditional Guesswork</h4>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#6B615B]">
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">•</span>
                <span>Buying multiple trendy products based on social media hype that irritate your barrier.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">•</span>
                <span>Not knowing if a spot is dry irritation, hormonal acne, or fungal sensitivity.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">•</span>
                <span>Waiting months for doctor appointments without any organized skin history to share.</span>
              </li>
            </ul>
          </div>

          {/* DermaVision Way */}
          <div className="bg-[#FAF1EC]/60 border border-[#EFCAAD] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#C46D46]">
              <span className="text-lg">✅</span>
              <h4 className="text-base font-bold text-[#2B2623]">With DermaVision</h4>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#2B2623]">
              <li className="flex items-start gap-2">
                <HiOutlineCheckCircle className="text-emerald-600 text-base shrink-0 mt-0.5" />
                <span>Instant 5-second camera scan with clear, easy scores you can understand.</span>
              </li>
              <li className="flex items-start gap-2">
                <HiOutlineCheckCircle className="text-emerald-600 text-base shrink-0 mt-0.5" />
                <span>Personalized product matches filtered for safe, gentle, compatible ingredients.</span>
              </li>
              <li className="flex items-start gap-2">
                <HiOutlineCheckCircle className="text-emerald-600 text-base shrink-0 mt-0.5" />
                <span>One-tap doctor locator and downloadable PDF report ready for your clinic visit.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── 4 TRUST & SAFETY PILLARS ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8DFD8] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-lg">
            <HiOutlineShieldCheck />
          </div>
          <h4 className="text-sm font-bold text-[#2B2623]">100% Private</h4>
          <p className="text-xs text-[#7A7069] leading-relaxed">
            Your face data is processed securely. We never sell or share your photos with advertisers.
          </p>
        </div>

        <div className="bg-white border border-[#E8DFD8] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-lg">
            <HiOutlineHeart />
          </div>
          <h4 className="text-sm font-bold text-[#2B2623]">Gentle Formulas</h4>
          <p className="text-xs text-[#7A7069] leading-relaxed">
            Every product recommendation is screened to prioritize skin-friendly, barrier-safe ingredients.
          </p>
        </div>

        <div className="bg-white border border-[#E8DFD8] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-lg">
            <HiOutlineDocumentText />
          </div>
          <h4 className="text-sm font-bold text-[#2B2623]">Clinical Telehealth</h4>
          <p className="text-xs text-[#7A7069] leading-relaxed">
            Export standardized PDF telemetry sheets to save precious time during doctor consultations.
          </p>
        </div>

        <div className="bg-white border border-[#E8DFD8] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-lg">
            <HiOutlineRefresh />
          </div>
          <h4 className="text-sm font-bold text-[#2B2623]">Track Progress</h4>
          <p className="text-xs text-[#7A7069] leading-relaxed">
            Take routine scans every two weeks to observe real improvements in your skin health score.
          </p>
        </div>
      </section>

      {/* ─── CALL TO ACTION ─── */}
      <section className="bg-white border border-[#E8DFD8] rounded-3xl p-8 sm:p-12 shadow-sm text-center max-w-3xl mx-auto space-y-6">
        <div className="w-12 h-12 rounded-full bg-[#FAF1EC] border border-[#EFCAAD] text-[#DC926E] flex items-center justify-center mx-auto text-2xl shadow-xs">
          <HiOutlineSparkles />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-[#2B2623]">
            Ready to See What Your Skin Needs?
          </h3>
          <p className="text-xs sm:text-sm text-[#7A7069] max-w-lg mx-auto">
            Take a quick scan now to get your personalized skin score, targeted routine, and clinical guidance.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/analysis"
            className="w-full sm:w-auto bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs sm:text-sm font-semibold px-6 py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Start Free Skin Scan</span>
            <HiArrowRight />
          </Link>

          <Link
            to="/products"
            className="w-full sm:w-auto bg-[#FAF8F5] hover:bg-[#F5EBE6] text-[#4A423D] border border-[#E8DFD8] text-xs sm:text-sm font-semibold px-5 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <HiOutlineColorSwatch className="text-[#DC926E]" />
            <span>Browse Products</span>
          </Link>

          <Link
            to="/dermatologists"
            className="w-full sm:w-auto bg-[#FAF8F5] hover:bg-[#F5EBE6] text-[#4A423D] border border-[#E8DFD8] text-xs sm:text-sm font-semibold px-5 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <HiOutlineUserGroup className="text-[#DC926E]" />
            <span>Find Nearby Doctors</span>
          </Link>
        </div>
      </section>

    </div>
  );
};

export default Technology;

