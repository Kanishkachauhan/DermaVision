// src/components/recommendations/SkinAnalysisSummaryCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineSparkles,
  HiOutlineDocumentReport,
  HiOutlineCamera,
  HiOutlineShieldCheck,
  HiOutlineInformationCircle,
} from 'react-icons/hi';

const SkinAnalysisSummaryCard = ({ report, onOpenReportModal }) => {
  if (!report) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8DFD8] p-6 sm:p-8 shadow-sm text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-2xl mb-4">
          <HiOutlineCamera />
        </div>
        <h3 className="text-lg font-bold text-[#2B2623] mb-1">No Skin Analysis Report Yet</h3>
        <p className="text-sm text-[#7A7069] max-w-md mx-auto mb-6">
          Complete your quick 3-second AI facial scan to detect skin concerns and unlock your personalized clinical product regimen.
        </p>
        <Link
          to="/analysis"
          className="inline-flex items-center gap-2 bg-[#DC926E] hover:bg-[#c87e5b] text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow transition-all cursor-pointer"
        >
          <HiOutlineSparkles className="text-base" />
          <span>Start AI Skin Analysis</span>
        </Link>
      </div>
    );
  }

  const score = report.healthScore ?? 75;
  const skinType = report.skinType || 'Combination';
  const predictions = report.predictions || [];

  const getScoreColor = (val) => {
    if (val >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', stroke: '#10B981', label: 'Optimal Condition' };
    if (val >= 60) return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', stroke: '#3B82F6', label: 'Good (Mild Concern)' };
    if (val >= 40) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', stroke: '#F59E0B', label: 'Requires Attention' };
    return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', stroke: '#EF4444', label: 'Compromised Barrier' };
  };

  const scoreInfo = getScoreColor(score);
  const formattedDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent Scan';

  return (
    <div className="bg-white rounded-2xl border border-[#E8DFD8] p-5 sm:p-7 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Left: Overall Health & Face Thumbnail */}
        <div className="flex items-center gap-4 sm:gap-5 w-full lg:w-auto">
          {/* Circular Score Gauge */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[#FAF1EC]"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                stroke={scoreInfo.stroke}
                strokeWidth="3.2"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl sm:text-2xl font-black text-[#2B2623]">{score}</span>
              <span className="text-[10px] text-[#7A7069] uppercase font-semibold">/ 100</span>
            </div>
          </div>

          {/* Report Context */}
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${scoreInfo.bg} ${scoreInfo.text} ${scoreInfo.border}`}>
                {scoreInfo.label}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FAF1EC] text-[#46352F] border border-[#EFCAAD]">
                {skinType} Skin
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#2B2623]">
              Diagnostic Analysis Overview
            </h2>
            <div className="text-xs text-[#7A7069] flex items-center gap-2 mt-0.5">
              <span>Scanned on {formattedDate}</span>
              <span>•</span>
              <span className="font-mono text-[11px] text-slate-500">ID: {report._id?.slice(-6).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Center: Detected Concerns Chips */}
        <div className="flex-1 max-w-xl w-full">
          <div className="text-xs font-semibold text-[#7A7069] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <HiOutlineShieldCheck className="text-[#DC926E] text-sm" />
            <span>AI Detected Concerns</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {predictions.length > 0 ? (
              predictions.map((p, idx) => {
                const isHigh = p.severity === 'High';
                const isMod = p.severity === 'Moderate';
                const badgeColor = isHigh
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isMod
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={idx}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-2 ${badgeColor}`}
                  >
                    <span className="font-semibold">{p.condition}</span>
                    <span className="text-[10px] opacity-80 uppercase px-1.5 py-0.2 bg-white/60 rounded">
                      {p.severity}
                    </span>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-[#7A7069] italic">
                Optimal barrier homeostasis; no acute blemish markers identified.
              </span>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-[#E8DFD8]">
          <Link
            to="/analysis"
            className="flex-1 lg:flex-none text-center text-xs font-semibold px-4 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#2B2623] border border-[#CBD5E1] transition-all cursor-pointer"
          >
            Retake Scan
          </Link>
          {onOpenReportModal && (
            <button
              onClick={onOpenReportModal}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-[#DC926E] hover:bg-[#c87e5b] text-white shadow-sm transition-all cursor-pointer"
            >
              <HiOutlineDocumentReport className="text-sm" />
              <span>Full Clinical Report</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default SkinAnalysisSummaryCard;
