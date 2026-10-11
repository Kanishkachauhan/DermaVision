import React, { useState } from 'react';
import {
  HiChevronDown,
  HiArrowRight,
  HiOutlinePhotograph,
  HiOutlineSparkles,
  HiOutlineDocumentReport,
  HiOutlineShieldCheck,
  HiOutlineLocationMarker,
  HiOutlineCheckCircle,
  HiOutlineDownload,
  HiOutlineSearch,
  HiOutlineAdjustments
} from 'react-icons/hi';
import { Link } from 'react-router-dom';

// Import marquee images
import scanUiImg from '../assets/dermavision_scan_ui_1789367756914.jpg';
import macroSkinImg from '../assets/dermavision_macro_skin_1789367779537.jpg';
import clinicalSuiteImg from '../assets/dermavision_clinical_suite_1789367799745.jpg';
import aiTelemetryImg from '../assets/dermavision_ai_telemetry_1789367830219.jpg';

const Home = () => {
  // Simulator State
  const [activePreset, setActivePreset] = useState('acne_pores');
  const [isScanning, setIsScanning] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Clinic Search State
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedClinicType, setSelectedClinicType] = useState('all');

  // FAQ State
  const [openFaq, setOpenFaq] = useState(null);

  const marqueeItems = [
    {
      id: 1,
      title: "Deep Learning Concern Detector",
      subtitle: "Acne, pores, & scar recognition",
      img: scanUiImg,
      tag: "Deep Vision AI"
    },
    {
      id: 2,
      title: "Micro-Epidermal Mapping",
      subtitle: "Pigmentation & spot analysis",
      img: macroSkinImg,
      tag: "Confidence Scoring"
    },
    {
      id: 3,
      title: "Clinical Clinic Network",
      subtitle: "Nearby dermatologist locator",
      img: clinicalSuiteImg,
      tag: "Professional Care"
    },
    {
      id: 4,
      title: "Automated Report Generator",
      subtitle: "Downloadable PDF health reports",
      img: aiTelemetryImg,
      tag: "Health Analytics"
    }
  ];

  // Detected Concerns from Abstract
  const detectedConcernsList = [
    { name: "Acne Vulgaris & Blemishes", category: "Active Concern", severity: "Moderate" },
    { name: "Blackheads & Whiteheads", category: "Comedones", severity: "Mild" },
    { name: "Enlarged Pores", category: "Texture", severity: "Moderate" },
    { name: "Pigmentation & Dark Spots", category: "Tone Variance", severity: "Mild" },
    { name: "Acne Scars", category: "Structural", severity: "Low" },
    { name: "Skin Redness & Erythema", category: "Sensitivity", severity: "Low" },
    { name: "Skin Type Classification", category: "Combination / Sensitive", severity: "Type Result" }
  ];

  // Interactive Presets based on abstract details
  const scanPresets = {
    acne_pores: {
      title: "Acne, Blackheads & Pore Analysis",
      confidenceScore: "97.4%",
      skinType: "Combination (Oily T-Zone)",
      detectedConcerns: [
        "Mild Inflammatory Acne (Forehead)",
        "Open Comedones (Blackheads on Nose)",
        "Enlarged Pore Clusters (Cheeks)"
      ],
      routine: {
        morning: "Gentle Salicylic Acid Cleanser → Niacinamide Serum → Oil-Free SPF 50",
        evening: "Hydrating Cleanser → Mild Retinoid → Barrier Repair Moisturizer"
      },
      preventiveTips: [
        "Avoid touch contamination on active acne sites.",
        "Double cleanse in the evening to clear pore congestion."
      ],
      recommendedCare: "Salicylic Acid 2% Exfoliant, Centella Soothing Gel"
    },
    pigmentation_spots: {
      title: "Pigmentation, Dark Spots & Scars",
      confidenceScore: "96.1%",
      skinType: "Sensitive / Hyperpigmented",
      detectedConcerns: [
        "Post-Inflammatory Hyperpigmentation (PIH)",
        "Sun Spot Accumulation (Cheekbones)",
        "Shallow Atrophic Acne Scars"
      ],
      routine: {
        morning: "Vitamin C Antioxidant Serum → Hydrating Moisturizer → Broad Spectrum Sunscreen",
        evening: "Gentle Cleanser → Tranexamic Acid / Azelaic Acid → Ceramides Cream"
      },
      preventiveTips: [
        "Reapply SPF 50 every 2 hours during outdoor exposure.",
        "Incorporate antioxidants to prevent melanin oxidation."
      ],
      recommendedCare: "Azelaic Acid 10%, Vitamin C 15% Serum"
    },
    type_redness: {
      title: "Redness, Barrier & Skin Type",
      confidenceScore: "98.5%",
      skinType: "Reactive / Sensitive Dry",
      detectedConcerns: [
        "Diffuse Erythema (Nasal & Cheek Flushes)",
        "Disrupted Lipid Barrier",
        "Dehydration Fine Lines"
      ],
      routine: {
        morning: "Non-Foaming Cream Cleanser → Hyaluronic Acid → Barrier Protection Cream",
        evening: "Gentle Micellar Water → Squalane Oil → Rich Ceramide Cream"
      },
      preventiveTips: [
        "Avoid harsh physical scrubs and high-concentration acids.",
        "Use lukewarm water when washing face to reduce flushes."
      ],
      recommendedCare: "Ceramide NP Barrier Balm, Panthenol Soothing Lotion"
    }
  };

  // Nearby Dermatologists Mock Data
  const sampleClinics = [
    {
      id: 1,
      name: "Dr. Ananya Sharma, MD (Dermatology)",
      clinic: "Apex Skin & Laser Center",
      distance: "1.2 km away",
      rating: "4.9 ★ (140+ reviews)",
      specialty: "Acne, Pigmentation & Laser Therapy",
      address: "Suite 302, Medical Enclave",
      type: "dermatologist"
    },
    {
      id: 2,
      name: "Dr. Rajesh Kumar, MBBS, DDVL",
      clinic: "DermaCare Advanced Clinic",
      distance: "2.8 km away",
      rating: "4.8 ★ (95+ reviews)",
      specialty: "Clinical Dermatology & Scar Repair",
      address: "Building B, Health Hub",
      type: "dermatologist"
    },
    {
      id: 3,
      name: "MediSkin Diagnostic Center",
      clinic: "Comprehensive Skin & Allergy Clinic",
      distance: "3.5 km away",
      rating: "4.7 ★ (210+ reviews)",
      specialty: "Patch Testing & Phototherapy",
      address: "Main Avenue, Opp City Park",
      type: "clinic"
    }
  ];

  const triggerScanSimulation = (mode) => {
    setActivePreset(mode);
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1100);
  };

  const handleDownloadReport = () => {
    setDownloadingReport(true);
    setTimeout(() => {
      setDownloadingReport(false);
      alert("DermaVision Skin Health Report downloaded successfully! (Sample PDF generated with AI Confidence Scores and Care Guidelines)");
    }, 1500);
  };

  const faqs = [
    {
      q: "What skin concerns can DermaVision detect?",
      a: "DermaVision's Deep Learning and Computer Vision models detect 9 key skin parameters: acne, blackheads, whiteheads, enlarged pores, pigmentation, dark spots, acne scars, skin redness, and overall skin type (oily, dry, combination, sensitive, normal)."
    },
    {
      q: "How are the confidence scores generated?",
      a: "The system evaluates sub-surface feature density, texture metrics, and color variance against a database of over 500,000 clinically validated skin images to compute an AI Confidence Score (e.g., 97.4%) for each detected concern."
    },
    {
      q: "Does DermaVision provide downloadable reports?",
      a: "Yes! The platform generates a comprehensive, downloadable PDF skin health report containing your detected skin concerns, confidence breakdown, personalized skincare routines, product suggestions, and preventive care guidelines."
    },
    {
      q: "Is DermaVision a replacement for a medical doctor?",
      a: "No. DermaVision is designed as an AI decision-support and early awareness system. It helps you monitor your skin health and provides recommendations, but encourages consultation with qualified dermatologists whenever clinical diagnosis is required."
    },
    {
      q: "How does the nearby clinic finder work?",
      a: "DermaVision uses location assistance to locate verified dermatologists and skin clinics in your vicinity, allowing you to easily schedule professional consultations."
    }
  ];

  return (
    <div id="home" className="space-y-14 sm:space-y-20 md:space-y-28 pb-14 sm:pb-20 overflow-hidden w-full">

      {/* SECTION 1: HERO SECTION */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-4 sm:pt-8 md:pt-14">
        {/* Subtle geometric backdrop frame */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[480px] md:w-[600px] h-[220px] sm:h-[350px] bg-[#F5D8C9]/30 rounded-lg blur-3xl -z-10 pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* Hero Content */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-7 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F5EBE6] border border-[#EACFC2] text-[11px] sm:text-xs font-semibold text-[#C46D46] tracking-wide">
              <HiOutlineSparkles className="text-sm shrink-0" />
              <span>AI-POWERED SKIN ANALYSIS &amp; DECISION SUPPORT</span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#2B2623] tracking-tight leading-[1.18]">
              DermaVision <br />
              <span className="text-[#DC926E] font-normal">AI Skin Analysis &amp; Recommendation System</span>
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-[#6B615B] leading-relaxed max-w-2xl font-light">
              An intelligent platform leveraging Deep Learning and Computer Vision to analyze facial skin images, identify concerns like acne, pores, pigmentation, and dark spots, compute confidence scores, generate downloadable health reports, and connect you with nearby dermatologists.
            </p>

            {/* Quick Feature Badges */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 text-[11px] sm:text-xs">
              <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-white border border-[#E8DFD8] text-[#5A524C] font-semibold">
                ✓ Deep Learning Detection
              </span>
              <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-white border border-[#E8DFD8] text-[#5A524C] font-semibold">
                ✓ AI Confidence Scoring
              </span>
              <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-white border border-[#E8DFD8] text-[#5A524C] font-semibold">
                ✓ Downloadable PDF Reports
              </span>
              <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-white border border-[#E8DFD8] text-[#5A524C] font-semibold">
                ✓ Nearby Dermatologist Locator
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <Link
                to="/analysis"
                className="w-full sm:w-auto bg-[#DC926E] hover:bg-[#c87e5b] text-white font-semibold px-6 sm:px-7 py-3 sm:py-3.5 rounded-md shadow-sm transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <span>Start AI Skin Analysis</span>
                <HiArrowRight />
              </Link>

              <a
                href="#dermatologists"
                className="w-full sm:w-auto bg-[#F5EBE6] hover:bg-[#EAE0DA] text-[#4A423D] font-semibold px-5 sm:px-6 py-3 sm:py-3.5 rounded-md transition-all duration-200 border border-[#E5D7CE] text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <HiOutlineLocationMarker className="text-base text-[#DC926E]" />
                <span>Find Nearby Clinics</span>
              </a>
            </div>

          </div>

          {/* Hero Visual Card */}
          <div className="lg:col-span-5 relative mt-4 lg:mt-0">
            <div className="relative rounded-xl overflow-hidden shadow-xl border border-[#E8DFD8] bg-[#FAF8F5] p-2.5 sm:p-3">
              <div className="relative rounded-lg overflow-hidden group">
                <img
                  src={scanUiImg}
                  alt="DermaVision AI Facial Analysis"
                  className="w-full h-64 sm:h-80 md:h-96 lg:h-[420px] object-cover object-center transform transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                {/* Floating AI Confidence Badge */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-white/95 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-md border border-white/40 shadow-sm flex items-center gap-2">
                  <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[11px] sm:text-xs font-bold text-[#2B2623]">AI Confidence Score: 97.4%</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 bg-[#2B2623]/95 backdrop-blur-md p-3 sm:p-4 rounded-md text-white border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#D8CFCA]">
                    <span>Detected: Acne, Blackheads &amp; Pores</span>
                    <span className="text-[#DC926E] font-bold">Skin Type: Combination</span>
                  </div>
                  <div className="w-full bg-[#48413E] h-1.5 rounded-sm overflow-hidden">
                    <div className="bg-[#DC926E] h-full rounded-sm w-[97%]" />
                  </div>
                  <div className="flex justify-between items-center pt-1 text-[10px] sm:text-[11px] text-[#A89F99]">
                    <span>Decision Support Report Ready</span>
                    <span className="text-emerald-400 font-medium">Download PDF</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2: CONTINUOUS PICTURE MARQUEE SHOWCASE */}
      <section className="space-y-4 sm:space-y-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#DC926E]">
            Visual AI Showcase
          </span>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#2B2623]">
            Computer Vision Analysis &amp; Diagnostics
          </h2>
          <p className="text-xs sm:text-sm text-[#7A7069] max-w-xl mx-auto font-light">
            Continuous visual showcase of facial landmark telemetry, sub-surface pore mapping, clinical consultation, and downloadable report analytics.
          </p>
        </div>

        {/* Marquee Row 1 */}
        <div className="relative w-full overflow-hidden py-3 sm:py-4 bg-[#F5EBE6]/40 border-y border-[#E8DFD8]">
          <div className="animate-marquee gap-4 sm:gap-6 px-3">
            {[...marqueeItems, ...marqueeItems].map((item, idx) => (
              <div
                key={`m1-${idx}`}
                className="w-68 sm:w-80 md:w-96 flex-shrink-0 bg-white rounded-md overflow-hidden border border-[#E8DFD8] shadow-sm hover:shadow-md transition-all duration-300 group"
              >
                <div className="relative h-40 sm:h-48 md:h-52 overflow-hidden">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-[#2B2623]/85 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-sm">
                    {item.tag}
                  </div>
                </div>
                <div className="p-3 sm:p-4 space-y-1 bg-white">
                  <h4 className="font-bold text-xs sm:text-sm text-[#2B2623]">{item.title}</h4>
                  <p className="text-[11px] sm:text-xs text-[#8C837E]">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Marquee Row 2 */}
        <div className="relative w-full overflow-hidden py-3 sm:py-4">
          <div className="animate-marquee-reverse gap-4 sm:gap-6 px-3">
            {[...marqueeItems, ...marqueeItems].reverse().map((item, idx) => (
              <div
                key={`m2-${idx}`}
                className="w-68 sm:w-80 md:w-96 flex-shrink-0 bg-[#FAF8F5] rounded-md overflow-hidden border border-[#E8DFD8] shadow-sm hover:shadow-md transition-all duration-300 group"
              >
                <div className="relative h-40 sm:h-48 md:h-52 overflow-hidden">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-[#DC926E]/95 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-sm">
                    {item.tag}
                  </div>
                </div>
                <div className="p-3 sm:p-4 space-y-1 bg-white">
                  <h4 className="font-bold text-xs sm:text-sm text-[#2B2623]">{item.title}</h4>
                  <p className="text-[11px] sm:text-xs text-[#8C837E]">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: 9-POINT SKIN CONCERN DETECTION CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 space-y-8 sm:space-y-10">
        <div className="text-center space-y-2 sm:space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#DC926E]">
            Deep Learning Vision Model
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#2B2623]">
            Identifies 9 Key Skin Parameters
          </h2>
          <p className="text-xs sm:text-sm text-[#6B615B] font-light">
            Our computer vision model processes uploaded facial images to detect specific concerns and classify your skin type with quantitative accuracy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">01. Acne Vulgaris</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2 py-0.5 rounded-sm">Active Blemishes</span>
            </div>
            <p className="text-xs text-[#7A7069]">Identifies inflammatory papules, pustules, and breakout severity across facial zones.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">02. Blackheads &amp; Whiteheads</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2 py-0.5 rounded-sm">Comedones</span>
            </div>
            <p className="text-xs text-[#7A7069]">Maps open and closed comedones in the T-zone, nose, and chin areas.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">03. Enlarged Pores</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2 py-0.5 rounded-sm">Pore Density</span>
            </div>
            <p className="text-xs text-[#7A7069]">Calculates pore diameter and cluster density across cheek and forehead regions.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">04. Pigmentation &amp; Dark Spots</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2 py-0.5 rounded-sm">Melanin Maps</span>
            </div>
            <p className="text-xs text-[#7A7069]">Detects hyperpigmentation, sun spots, and uneven melanin concentration.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">05. Acne Scars</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2 py-0.5 rounded-sm">Post-Breakout</span>
            </div>
            <p className="text-xs text-[#7A7069]">Evaluates post-acne indentations, ice-pick scars, and surface texture irregularities.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">06. Redness &amp; Erythema</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2 py-0.5 rounded-sm">Inflammation</span>
            </div>
            <p className="text-xs text-[#7A7069]">Tracks vascular redness, rosacea tendencies, and sensitive skin reactions.</p>
          </div>

          <div className="p-4 sm:p-5 bg-white border border-[#E8DFD8] rounded-md shadow-sm space-y-2 hover:border-[#DC926E] transition-colors sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <span className="text-xs sm:text-sm font-bold text-[#2B2623]">07 - 09. Skin Type, Moisture Barrier &amp; Preventive Telemetry</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#DC926E] bg-[#F5EBE6] px-2.5 py-1 rounded-sm w-fit">Comprehensive Diagnostics</span>
            </div>
            <p className="text-xs text-[#7A7069] leading-relaxed">
              Classifies skin into Oily, Dry, Combination, Sensitive, or Normal types, calculates moisture retention, and offers tailored preventive care suggestions.
            </p>
          </div>

        </div>
      </section>

      {/* SECTION 4: INTERACTIVE AI SKIN ANALYSIS SIMULATOR */}
      <section id="analysis-simulator" className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
        <div className="bg-white rounded-xl border border-[#E8DFD8] shadow-lg overflow-hidden p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-[#E8DFD8]">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#F5EBE6] text-xs font-semibold text-[#DC926E]">
                <HiOutlineSparkles />
                <span>INTERACTIVE AI DEMO</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#2B2623]">
                Try DermaVision Skin Analysis
              </h2>
              <p className="text-xs sm:text-sm text-[#7A7069] max-w-xl font-light">
                Select a sample skin diagnostic mode below to simulate real-time neural vision processing, view AI confidence scores, and preview downloadable reports.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={() => triggerScanSimulation('acne_pores')}
                className={`flex-1 sm:flex-initial text-center justify-center px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${activePreset === 'acne_pores'
                    ? 'bg-[#DC926E] text-white shadow-sm'
                    : 'bg-[#F5EBE6] text-[#5A524C] hover:bg-[#EAE0DA]'
                  }`}
              >
                Acne &amp; Pores
              </button>
              <button
                onClick={() => triggerScanSimulation('pigmentation_spots')}
                className={`flex-1 sm:flex-initial text-center justify-center px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${activePreset === 'pigmentation_spots'
                    ? 'bg-[#DC926E] text-white shadow-sm'
                    : 'bg-[#F5EBE6] text-[#5A524C] hover:bg-[#EAE0DA]'
                  }`}
              >
                Pigmentation &amp; Spots
              </button>
              <button
                onClick={() => triggerScanSimulation('type_redness')}
                className={`flex-1 sm:flex-initial text-center justify-center px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${activePreset === 'type_redness'
                    ? 'bg-[#DC926E] text-white shadow-sm'
                    : 'bg-[#F5EBE6] text-[#5A524C] hover:bg-[#EAE0DA]'
                  }`}
              >
                Redness &amp; Skin Type
              </button>
            </div>
          </div>

          {/* Simulator Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

            {/* Visual Scan Screen */}
            <div className="lg:col-span-5 relative rounded-lg overflow-hidden border border-[#E8DFD8] bg-[#FAF8F5] h-60 sm:h-72 md:h-[380px] flex items-center justify-center group">
              <img
                src={scanUiImg}
                alt="AI Analysis Simulation"
                className="w-full h-full object-cover"
              />

              {/* Scan Overlay Animation */}
              {isScanning && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 p-4 text-center">
                  <div className="w-10 sm:w-14 h-10 sm:h-14 border-3 sm:border-4 border-[#DC926E] border-t-transparent rounded-full animate-spin" />
                  <p className="text-white text-[11px] sm:text-xs font-semibold tracking-wide uppercase">
                    Computing Deep Learning Feature Vectors...
                  </p>
                </div>
              )}

              {!isScanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-1 bg-[#DC926E]/80 shadow-[0_0_15px_#DC926E] animate-pulse top-1/2 relative" />
                </div>
              )}

              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-md text-white text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>AI Confidence: <strong className="text-[#DC926E]">{scanPresets[activePreset].confidenceScore}</strong></span>
              </div>
            </div>

            {/* Generated Analysis Results */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8DFD8]">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#2B2623]">
                    {scanPresets[activePreset].title}
                  </h3>
                  <p className="text-xs text-[#7A7069] mt-0.5">
                    Detected Skin Type: <span className="font-semibold text-[#DC926E]">{scanPresets[activePreset].skinType}</span>
                  </p>
                </div>

                <button
                  onClick={handleDownloadReport}
                  disabled={downloadingReport}
                  className="w-full sm:w-auto bg-[#2B2623] hover:bg-[#423C38] text-white text-xs font-semibold px-4 py-2.5 rounded-md flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <HiOutlineDownload className="text-sm text-[#DC926E]" />
                  <span>{downloadingReport ? 'Generating PDF...' : 'Download Report'}</span>
                </button>
              </div>

              {/* Detected Concerns */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2623]">
                  Detected Skin Concerns:
                </h4>
                <div className="space-y-1.5">
                  {scanPresets[activePreset].detectedConcerns.map((concern, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[#5A524C] bg-[#FAF8F5] p-2.5 rounded-md border border-[#E8DFD8]">
                      <HiOutlineCheckCircle className="text-emerald-600 text-sm flex-shrink-0" />
                      <span>{concern}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skincare Routine */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2B2623]">
                  Personalized Skincare Routine:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[#FFF9F6] border border-[#E8DFD8] rounded-md space-y-1">
                    <span className="font-bold text-[#DC926E]">Morning Routine ☀️</span>
                    <p className="text-[#6B615B] text-[11px] leading-relaxed">{scanPresets[activePreset].routine.morning}</p>
                  </div>
                  <div className="p-3 bg-[#FAF8F5] border border-[#E8DFD8] rounded-md space-y-1">
                    <span className="font-bold text-[#2B2623]">Evening Routine 🌙</span>
                    <p className="text-[#6B615B] text-[11px] leading-relaxed">{scanPresets[activePreset].routine.evening}</p>
                  </div>
                </div>
              </div>

              {/* Recommended Product Formulations */}
              <div className="p-3.5 bg-white rounded-md border border-[#E8DFD8] space-y-1 text-xs">
                <span className="font-semibold text-[#2B2623]">Recommended Active Formulations: </span>
                <span className="text-[#6B615B]">{scanPresets[activePreset].recommendedCare}</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SECTION 5: NEARBY DERMATOLOGIST & CLINIC LOCATOR */}
      <section id="dermatologists" className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 space-y-8 sm:space-y-10">
        <div className="bg-gradient-to-br from-[#FAF8F5] to-[#F5EBE6] rounded-2xl border border-[#E8DFD8] p-5 sm:p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center gap-6 sm:gap-8">
            <div className="flex-1 space-y-3 sm:space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#DC926E]">
                Professional Care Connectivity
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2B2623]">
                Locate Nearby Dermatologists &amp; Skin Clinics
              </h2>
              <p className="text-xs sm:text-sm text-[#7A7069] max-w-md font-light leading-relaxed">
                After your AI skin analysis, DermaVision shows you an <strong className="text-[#2B2623]">interactive satellite map</strong> with
                verified dermatologists and certified clinics near you — so you can book a professional
                consultation with your skin report in hand.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { icon: '🛰️', text: 'Satellite Map View' },
                  { icon: '📍', text: 'GPS Location' },
                  { icon: '⭐', text: 'Rated Doctors' },
                  { icon: '📋', text: 'Book with Report' },
                ].map(({ icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A524C] bg-white border border-[#E8DFD8] px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
                    {icon} {text}
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  to="/dermatologists"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs sm:text-sm font-bold px-5 sm:px-6 py-3 rounded-xl shadow-sm transition-all text-center"
                >
                  <HiOutlineLocationMarker className="text-base" />
                  <span>Find Dermatologists Near Me</span>
                  <HiArrowRight className="text-base" />
                </Link>
                <Link
                  to="/analysis"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FAF8F5] text-[#5A524C] border border-[#E8DFD8] text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-sm transition-all text-center"
                >
                  Start Skin Analysis First
                </Link>
              </div>
            </div>

            {/* Visual preview */}
            <div className="hidden lg:flex flex-col items-center justify-center w-72 h-52 rounded-xl bg-[#1e293b] relative overflow-hidden border border-[#334155] shadow-xl flex-shrink-0">
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at 30% 40%, #DC926E 0%, transparent 50%), radial-gradient(circle at 70% 70%, #6B7CDB 0%, transparent 40%)'
              }} />
              <div className="relative z-10 text-center space-y-2">
                <div className="text-5xl">🛰️</div>
                <p className="text-white font-bold text-sm">Satellite Dermatologist Map</p>
                <p className="text-slate-400 text-xs">Unlocks after skin analysis</p>
              </div>
              {/* Fake pins */}
              {[['20%', '30%', '#DC926E'], ['60%', '50%', '#DC926E'], ['40%', '70%', '#6B7CDB']].map(([l, t, c], i) => (
                <div key={i} style={{ position: 'absolute', left: l, top: t, width: 12, height: 12, borderRadius: '50%', background: c, border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: DECISION SUPPORT DISCLAIMER & AI MISSION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
        <div className="p-5 sm:p-8 rounded-xl bg-white border border-[#E8DFD8] space-y-3 sm:space-y-4 text-left shadow-sm">
          <div className="flex items-center gap-2.5 sm:gap-3 text-[#DC926E]">
            <HiOutlineShieldCheck className="text-2xl shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-[#2B2623]">AI Decision-Support System Positioning</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#6B615B] leading-relaxed">
            DermaVision is engineered as an AI-powered skin analysis and decision-support system rather than a replacement for professional medical diagnosis. Its primary objective is to promote early skin health awareness, provide personalized skincare guidance, generate informative skin analysis reports, and connect users with qualified dermatologists when necessary.
          </p>
        </div>
      </section>

      {/* SECTION 7: FAQ ACCORDION */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 md:px-12 space-y-6 sm:space-y-8">
        <div className="text-center space-y-2 sm:space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#DC926E]">
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2B2623]">
            Understanding DermaVision
          </h2>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg border border-[#E8DFD8] overflow-hidden transition-all shadow-xs"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 font-semibold text-xs sm:text-sm text-[#2B2623] hover:text-[#DC926E] transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                <HiChevronDown
                  className={`text-base sm:text-lg shrink-0 transition-transform duration-300 ${openFaq === idx ? 'rotate-180 text-[#DC926E]' : 'text-[#8C837E]'
                    }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 text-xs text-[#6B615B] leading-relaxed border-t border-[#F5EBE6]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 8: CTA CALLOUT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
        <div className="relative rounded-2xl bg-gradient-to-r from-[#2B2623] via-[#38322F] to-[#2B2623] text-white p-6 sm:p-10 md:p-16 overflow-hidden shadow-xl text-center space-y-5 sm:space-y-6">
          <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
            <span className="text-xs font-semibold tracking-widest uppercase text-[#DC926E]">
              Ready for Intelligent Skin Management?
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
              Analyze Your Skin &amp; Generate Your Report
            </h2>
            <p className="text-xs sm:text-sm text-[#D8CFCA] font-light leading-relaxed">
              Analyze facial skin concerns, compute confidence scores, receive personalized routines, and locate nearby skin clinics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
            <Link
              to="/analysis"
              className="w-full sm:w-auto bg-[#DC926E] hover:bg-[#c87e5b] text-white font-semibold text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-3.5 rounded-md shadow-md transition-all duration-200 text-center"
            >
              Launch AI Skin Analysis
            </Link>
            <Link
              to="/register"
              className="w-full sm:w-auto bg-[#3D3734] hover:bg-[#4A4340] text-white font-semibold text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-3.5 rounded-md border border-[#524A46] transition-all text-center"
            >
              Register Account
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;