// src/components/recommendations/RecommendationHistorySection.jsx
import React from 'react';
import {
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineDocumentReport,
  HiOutlineSparkles,
  HiArrowRight,
} from 'react-icons/hi';

const RecommendationHistorySection = ({
  recommendations = [],
  activeRecommendationId = null,
  onSelectRecommendation,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8DFD8] p-8 text-center max-w-xl mx-auto my-8">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-xl mb-3">
          <HiOutlineClock />
        </div>
        <h3 className="text-base font-bold text-[#2B2623] mb-1">No Past Regimens Recorded</h3>
        <p className="text-xs text-[#7A7069]">
          Every time you complete a scan and receive personalized recommendations, the history will be archived here for tracking your skincare progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-[#2B2623] flex items-center gap-2">
          <span>Recommendation History</span>
          <span className="text-xs font-semibold bg-[#FAF1EC] text-[#DC926E] px-2.5 py-0.5 rounded-full border border-[#EFCAAD]">
            {recommendations.length} Runs
          </span>
        </h2>
        <p className="text-xs text-[#7A7069] mt-0.5">
          Review historical regimens and see how your clinical formulations adjusted over time as your skin improved.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec) => {
          const isCurrent = String(rec._id) === String(activeRecommendationId);
          const dateStr = rec.createdAt || rec.generatedAt
            ? new Date(rec.createdAt || rec.generatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Recent Date';

          const productsCount = rec.selectedProducts?.length || 0;
          const conditions = rec.recommendationReasons?.map((r) => r.condition) || [];

          return (
            <div
              key={rec._id}
              className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                isCurrent
                  ? 'bg-gradient-to-br from-white to-[#FAF1EC]/30 border-[#DC926E] shadow-sm ring-1 ring-[#DC926E]/40'
                  : 'bg-white border-[#E8DFD8] hover:border-[#CBD5E1] shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#7A7069]">
                    <HiOutlineClock className="text-[#DC926E]" />
                    <span>{dateStr}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isCurrent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isCurrent ? 'Current Active' : 'Superseded'}
                  </span>
                </div>

                <div className="text-sm font-bold text-[#2B2623] mb-1">
                  Clinical Formulation Regimen
                </div>

                <div className="text-xs text-[#5A524C] flex items-center gap-2 mb-3">
                  <span>{productsCount} Curated Products</span>
                  {rec.report && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Report: {String(rec.report._id || rec.report).slice(-6).toUpperCase()}
                      </span>
                    </>
                  )}
                </div>

                {conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {conditions.slice(0, 3).map((cond, cIdx) => (
                      <span
                        key={cIdx}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[#46352F] border border-[#E8DFD8] truncate max-w-[200px]"
                      >
                        {cond}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onSelectRecommendation && onSelectRecommendation(rec)}
                className={`w-full text-xs font-semibold py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#2B2623] text-white hover:bg-black border-transparent'
                    : 'bg-white hover:bg-[#FAF8F5] text-[#2B2623] border-[#CBD5E1]'
                }`}
              >
                <span>{isCurrent ? 'Currently Viewing' : 'Inspect Regimen'}</span>
                <HiArrowRight className="text-xs" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendationHistorySection;
