import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  HiChevronDown,
  HiOutlineSparkles,
  HiOutlineQuestionMarkCircle,
  HiOutlineShieldCheck,
  HiOutlineLightBulb,
  HiOutlineColorSwatch,
  HiOutlineUserGroup,
  HiArrowRight,
  HiOutlineSearch,
} from "react-icons/hi";

const FAQ = () => {
  const [openFaq, setOpenFaq] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { id: "all", label: "All Questions", icon: <HiOutlineQuestionMarkCircle /> },
    { id: "scan", label: "Smart Scan & Accuracy", icon: <HiOutlineLightBulb /> },
    { id: "products", label: "Products & Routine", icon: <HiOutlineColorSwatch /> },
    { id: "doctors", label: "Doctors & Clinical Care", icon: <HiOutlineUserGroup /> },
    { id: "privacy", label: "Privacy & Security", icon: <HiOutlineShieldCheck /> },
  ];

  const faqList = [
    {
      category: "scan",
      q: "What skin concerns can DermaVision detect?",
      a: "DermaVision currently detects 5 primary skin concerns: Acne, Enlarged Pores, Facial Redness, Pigmentation (dark spots & uneven tone), and Dark Circles. Our detection models focus specifically on these five areas to ensure maximum accuracy and reliable recommendations.",
    },
    {
      category: "scan",
      q: "How accurate is the camera scan?",
      a: "Our computer vision engine is calibrated against thousands of clinically validated skin images. It maps 468 facial contour points to compensate for head tilts and ambient lighting variations, delivering consistent high-confidence telemetry (typically over 95% confidence).",
    },
    {
      category: "scan",
      q: "Do I need special equipment or lighting to take a photo?",
      a: "No special equipment needed! A standard smartphone or webcam selfie works great. For best results, face a natural light source (like a window) during daytime, ensure your face is clean and makeup-free, and look straight into the camera lens.",
    },
    {
      category: "products",
      q: "How are skincare products matched to my skin?",
      a: "Our recommendation engine matches detected skin concerns (such as excess oil, redness, or barrier dehydration) with safe, clinically proven active ingredients. For example, sensitive skin profiles prioritize soothing Centella and Ceramides while filtering out harsh physical scrubs and drying alcohols.",
    },
    {
      category: "products",
      q: "Does DermaVision sell or push specific sponsored products?",
      a: "DermaVision focuses on ingredient-based recommendations. We recommend gentle, tested formulations and explain why each active ingredient helps your skin so you can make informed decisions without bias.",
    },
    {
      category: "products",
      q: "Can I download my skincare routine as a PDF?",
      a: "Yes! Every completed scan provides an option to download a comprehensive clinical report PDF containing your overall skin score, detected metrics, morning/evening routine steps, and ingredient guidelines.",
    },
    {
      category: "doctors",
      q: "Is DermaVision a replacement for a dermatologist?",
      a: "No. DermaVision is designed as an AI decision-support and early awareness tool. While it helps you understand everyday skin conditions and build effective routines, persistent concerns, cystic acne, or suspicious lesions should always be evaluated by a board-certified dermatologist.",
    },
    {
      category: "doctors",
      q: "How does the nearby dermatologist clinic finder work?",
      a: "Using your browser's location permission, DermaVision locates verified dermatology clinics and specialists in your city, showing addresses, clinic details, and direct contact options.",
    },
    {
      category: "privacy",
      q: "Are my photos kept private and secure?",
      a: "Absolutely. DermaVision processes scans securely directly in your browser. We never sell your facial photos to advertisers or third parties, and your diagnostic telemetry is kept strictly confidential.",
    },
    {
      category: "privacy",
      q: "Do I have to create an account to test the system?",
      a: "You can explore the live scanner simulator, technology explanations, and sample routines freely. Creating a free account allows you to securely save your analysis history, track skin improvement over time, and export doctor-ready PDF reports.",
    },
  ];

  // Filter based on category and search query
  const filteredFaqs = faqList.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-14 space-y-10 sm:space-y-14">
      
      {/* ─── HERO HEADER ─── */}
      <section className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF1EC] border border-[#EFCAAD] text-xs font-bold text-[#C46D46] uppercase tracking-wider shadow-xs">
          <HiOutlineSparkles className="text-sm shrink-0" />
          <span>Help &amp; Knowledge Base</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2B2623] tracking-tight">
          Frequently Asked <span className="text-[#DC926E]">Questions</span>
        </h1>

        <p className="text-sm sm:text-base text-[#6B615B] leading-relaxed">
          Find clear answers to common questions about DermaVision’s facial scanning, skincare ingredient matching, and clinical doctor tools.
        </p>

        {/* Search Bar */}
        <div className="pt-3 max-w-md mx-auto relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C837E] text-lg pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g. accuracy, privacy, products)..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#E8DFD8] rounded-xl text-xs sm:text-sm text-[#2B2623] placeholder-[#A89F99] focus:outline-none focus:border-[#DC926E] focus:ring-2 focus:ring-[#DC926E]/20 shadow-xs transition-all"
          />
        </div>
      </section>

      {/* ─── CATEGORY FILTER PILLS ─── */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
              setOpenFaq(0);
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-xs ${
              selectedCategory === cat.id
                ? "bg-[#DC926E] text-white shadow-sm"
                : "bg-white text-[#5A524C] hover:bg-[#F5EBE6] border border-[#E8DFD8]"
            }`}
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ─── FAQ ACCORDION LIST ─── */}
      <section className="space-y-3.5">
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E8DFD8] overflow-hidden transition-all duration-200 shadow-xs hover:border-[#DC926E]/50"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-[#2B2623] hover:text-[#DC926E] transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="leading-snug">{faq.q}</span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen
                        ? "rotate-180 bg-[#FAF1EC] text-[#DC926E]"
                        : "bg-[#FAF8F5] text-[#8C837E]"
                    }`}
                  >
                    <HiChevronDown className="text-base" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-[#6B615B] leading-relaxed border-t border-[#F5EBE6]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#E8DFD8] p-6 space-y-3">
            <HiOutlineQuestionMarkCircle className="text-4xl text-[#DC926E] mx-auto" />
            <h3 className="text-base font-bold text-[#2B2623]">No questions found</h3>
            <p className="text-xs text-[#7A7069]">
              Try searching with different keywords or switch the category filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="text-xs text-[#DC926E] font-semibold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* ─── CONTACT & SUPPORT CARD ─── */}
      <section className="bg-[#FAF1EC] border border-[#EFCAAD] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-left">
          <h3 className="text-base sm:text-lg font-bold text-[#2B2623]">
            Still have questions or need clinical help?
          </h3>
          <p className="text-xs text-[#6B615B] max-w-md">
            Our team is here to support you. You can reach out directly or start a scan to test the analysis firsthand.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            to="/analysis"
            className="w-full sm:w-auto bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <span>Start Free Scan</span>
            <HiArrowRight />
          </Link>
          <Link
            to="/technology"
            className="w-full sm:w-auto bg-white hover:bg-[#FAF8F5] text-[#2B2623] border border-[#E8DFD8] text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl transition-all flex items-center justify-center"
          >
            How Technology Works
          </Link>
        </div>
      </section>

    </div>
  );
};

export default FAQ;
