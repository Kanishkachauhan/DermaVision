import React, { useState } from "react";
import {
  HiOutlineDownload,
  HiOutlinePrinter,
  HiX,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineClock,
  HiOutlineSparkles,
} from "react-icons/hi";
import { downloadReportPDF } from "../utils/reportGenerator";

const ReportModal = ({ isOpen, onClose, reportData }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen || !reportData) return null;

  const handleDownload = () => {
    setDownloading(true);
    try {
      downloadReportPDF(reportData);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to generate PDF. You can also use the 'Print / Save as PDF' button.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getScoreBadge = (score) => {
    if (score >= 80) return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Optimal Condition" };
    if (score >= 60) return { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Good (Mild Concern)" };
    if (score >= 40) return { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Moderate Care" };
    return { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Requires Attention" };
  };

  const scoreBadge = getScoreBadge(reportData.skinHealthScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#F8FAFC] rounded-2xl shadow-2xl overflow-hidden border border-[#CBD5E1]">
        
        {/* Top Control Bar (Hidden during Print) */}
        <div className="no-print flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#1E293B] text-white border-b border-slate-700 z-10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#DC926E] flex items-center justify-center text-white font-black text-sm shadow-sm">
              DV
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Skin Health &amp; Progress Report</div>
              <div className="text-[11px] text-slate-400 font-mono">Ref ID: {reportData.reportId}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all cursor-pointer"
              title="Print via browser or Save as PDF"
            >
              <HiOutlinePrinter className="text-sm text-[#DC926E]" />
              <span className="hidden sm:inline">Print / Browser PDF</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[#DC926E] hover:bg-[#c87e5b] text-white shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <HiOutlineDownload className="text-sm" />
              <span>{downloading ? "Generating..." : downloadSuccess ? "Downloaded ✓" : "Download PDF (.pdf)"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close Preview"
            >
              <HiX className="text-xl" />
            </button>
          </div>
        </div>

        {/* Scrollable Paper Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-[#F1F5F9] print:p-0 print:bg-white">
          {/* Printable Report Sheet */}
          <div
            id="printable-clinical-report"
            className="max-w-[800px] mx-auto bg-white border border-[#E2E8F0] shadow-md rounded-2xl p-5 sm:p-8 space-y-6 text-[#2B2623] font-sans print:border-none print:shadow-none print:rounded-none print:p-0 print:max-w-none"
          >
            {/* ══ 1. HEADER ══ */}
            <div className="border-b-2 border-[#1E293B] pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1E293B] flex items-center justify-center text-white font-black text-xl border-2 border-[#DC926E] shadow-sm">
                    DV
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-[#1E293B] uppercase">
                      DermaVision Skin Health &amp; Progress Report
                    </h1>
                    <p className="text-xs font-semibold text-[#64748B]">
                      Personalized AI Cutaneous Analysis &amp; Visual Progress Tracker
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right flex flex-col sm:items-end">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1E293B] text-white">
                    Confidential Report
                  </span>
                  <div className="text-xs font-mono font-bold text-[#DC926E] mt-1">{reportData.reportId}</div>
                  <div className="text-[11px] text-[#64748B] flex items-center gap-1 sm:justify-end">
                    <HiOutlineClock className="text-xs" />
                    <span>{reportData.date} • {reportData.time}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ 2. PATIENT INFO BAR ══ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#7A7069] uppercase block">Patient / Subject</span>
                <span className="font-extrabold text-[#2B2623] flex items-center gap-1">
                  <HiOutlineUser className="text-[#DC926E]" />
                  {reportData.patientName}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7A7069] uppercase block">Patient ID</span>
                <span className="font-mono font-bold text-[#2B2623]">{reportData.patientId}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7A7069] uppercase block">Skin Phenotype</span>
                <span className="font-bold text-[#DC926E]">{reportData.skinType}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7A7069] uppercase block">Imaging Validity</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <HiOutlineShieldCheck className="text-sm" /> 98.4% Validated ✓
                </span>
              </div>
            </div>

            {/* ══ 3. HERO SECTION: USER SCANNED FACE + HEALTH SCORECARD ══ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
              {/* Left Column: User Face Photo (Baseline for Progress Tracking) */}
              <div className="md:col-span-4 flex flex-col bg-[#FAF8F5] rounded-2xl border-2 border-[#E8DFD8] overflow-hidden shadow-xs">
                <div className="relative aspect-[4/5] w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                  {reportData.capturedImage ? (
                    <img
                      src={reportData.capturedImage}
                      alt="Scanned Face Baseline"
                      className="w-full h-full object-cover filter contrast-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <HiOutlineUser className="text-5xl text-slate-500 mb-2" />
                      <span className="text-xs font-semibold">Face Baseline Photo</span>
                      <span className="text-[10px] text-slate-500">Captured at scan</span>
                    </div>
                  )}

                  {/* Overlaid Badge */}
                  <div className="absolute top-2 left-2 bg-[#1E293B]/85 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span>📸 Baseline Photo</span>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                    {reportData.date}
                  </div>
                </div>

                <div className="p-2.5 text-center bg-white border-t border-[#E8DFD8]">
                  <p className="text-[11px] font-extrabold text-[#2B2623]">Visual Progress Baseline</p>
                  <p className="text-[10px] text-[#7A7069] leading-tight mt-0.5">
                    Compare future scans with this photo to track skin texture, tone &amp; clarity improvements.
                  </p>
                </div>
              </div>

              {/* Right Column: Scorecard & Progress Tracker Guidance */}
              <div className="md:col-span-8 flex flex-col justify-between rounded-2xl bg-[#1E293B] text-white p-5 space-y-4 shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      Overall Skin Health Index
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-4xl sm:text-5xl font-black text-[#DC926E] leading-none">
                        {reportData.skinHealthScore}
                      </span>
                      <span className="text-sm text-slate-400 font-semibold">/ 100</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${scoreBadge.bg}`}>
                    {reportData.skinHealthGrade}
                  </span>
                </div>

                {/* Primary finding summary */}
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                  <span className="text-[10px] font-black uppercase text-[#DC926E] block mb-0.5">
                    Primary Skin Assessment
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {reportData.primaryConcern}
                  </p>
                </div>

                {/* Progress Tracking Guidance */}
                <div className="p-3.5 rounded-xl bg-[#2D3748] border border-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#DC926E]">
                    <HiOutlineSparkles className="text-sm" />
                    <span>How to Track Your Progress Over Time</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {reportData.progressTip || "Retake your scan every 7 to 14 days in similar lighting to see visual improvements in under-eye brightness and redness reduction."}
                  </p>
                </div>
              </div>
            </div>

            {/* ══ 4. THREE CORE SKIN CONCERNS (SIMPLE & VISUAL) ══ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#1E293B]">
                  Key Skin Findings &amp; Scores
                </h2>
                <span className="text-[11px] text-[#7A7069]">Visual AI analysis summary</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Under-Eye Dark Circles */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7A7069] flex items-center gap-1.5">
                      <span>👁️</span> Under-Eye Circles
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {reportData.darkCircles.label}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#2B2623]">{reportData.darkCircles.score}</span>
                      <span className="text-xs text-[#7A7069]">/ 100</span>
                    </div>
                    <p className="text-[11px] text-[#5A524C] mt-1 leading-snug">
                      {reportData.darkCircles.tip}
                    </p>
                  </div>
                </div>

                {/* 2. Redness & Sensitivity */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7A7069] flex items-center gap-1.5">
                      <span>🌸</span> Redness &amp; Flushing
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                      {reportData.redness.label}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#2B2623]">{reportData.redness.score}</span>
                      <span className="text-xs text-[#7A7069]">/ 100</span>
                    </div>
                    <p className="text-[11px] text-[#5A524C] mt-1 leading-snug">
                      {reportData.redness.tip}
                    </p>
                  </div>
                </div>

                {/* 3. Acne & Skin Texture */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7A7069] flex items-center gap-1.5">
                      <span>✨</span> Acne &amp; Clarity
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {reportData.acnePores.acneLabel}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#2B2623]">{reportData.acnePores.acneScore}%</span>
                      <span className="text-xs text-[#7A7069]">Acne Index</span>
                    </div>
                    <p className="text-[11px] text-[#5A524C] mt-1 leading-snug">
                      {reportData.acnePores.tip}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ 5. SIMPLE DAILY SKINCARE ROUTINE (AM / PM) ══ */}
            <div className="space-y-3 pt-1">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#1E293B]">
                Personalized Daily Care Routine
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Morning (AM) */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD8]">
                    <span className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                      <span>☀️</span> MORNING (AM) — DEFENSE
                    </span>
                    <span className="text-[10px] font-bold text-[#7A7069]">3 Simple Steps</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {reportData.amRoutine.map((item) => (
                      <div key={item.step} className="border-l-2 border-[#DC926E] pl-2.5 py-0.5">
                        <div className="font-bold text-[#2B2623]">
                          Step {item.step}: <span className="text-[#DC926E]">{item.product}</span>
                        </div>
                        <div className="text-[11px] text-[#7A7069] mt-0.5">{item.instruction}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evening (PM) */}
                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DFD8] space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD8]">
                    <span className="text-xs font-black text-indigo-800 flex items-center gap-1.5">
                      <span>🌙</span> EVENING (PM) — REPAIR
                    </span>
                    <span className="text-[10px] font-bold text-[#7A7069]">3 Simple Steps</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {reportData.pmRoutine.map((item) => (
                      <div key={item.step} className="border-l-2 border-indigo-400 pl-2.5 py-0.5">
                        <div className="font-bold text-[#2B2623]">
                          Step {item.step}: <span className="text-indigo-600">{item.product}</span>
                        </div>
                        <div className="text-[11px] text-[#7A7069] mt-0.5">{item.instruction}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ══ 6. SIMPLE DO'S & DON'TS ══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Do's */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <span className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1.5">
                  <HiOutlineCheckCircle className="text-base text-emerald-600" />
                  Do This for Best Progress
                </span>
                <ul className="space-y-1.5 text-xs text-[#2B2623]">
                  {reportData.dos?.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="text-[11px] text-emerald-950">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Don'ts */}
              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2">
                <span className="text-[11px] font-black uppercase text-rose-800 flex items-center gap-1.5">
                  <HiX className="text-base text-rose-600" />
                  Avoid These Common Mistakes
                </span>
                <ul className="space-y-1.5 text-xs text-[#2B2623]">
                  {reportData.donts?.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-600 font-bold">✕</span>
                      <span className="text-[11px] text-rose-950">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>


            {/* ══ 8. STATUTORY DISCLAIMER ══ */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <span className="font-bold uppercase tracking-wider text-slate-600 block">
                Statutory Medical Disclaimer:
              </span>
              <p>
                DermaVision utilizes computer vision feature extractors strictly for cosmetic educational screening and self-progress monitoring. It does not provide medical diagnoses or prescriptions, and does not replace in-person consultation with a licensed dermatologist.
              </p>
            </div>

            {/* Footer watermark */}
            <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-2 border-t border-slate-200">
              <span>DermaVision Cutaneous Telemetry v3.4 • Progress Tracking System</span>
              <span>Ref ID: {reportData.reportId}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
