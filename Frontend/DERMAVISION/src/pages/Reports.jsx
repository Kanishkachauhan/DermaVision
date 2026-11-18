// src/pages/Reports.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineDocumentReport,
  HiOutlineSparkles,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineEye,
  HiOutlineDownload,
  HiOutlineArrowRight,
  HiOutlineRefresh,
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { fetchMyReportsApi } from '../utils/api';
import { buildReportData } from '../utils/reportGenerator';
import ReportModal from '../components/ReportModal';

const Reports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Load user's saved skin analysis reports from MongoDB
  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyReportsApi(1, 50);
      if (res?.reports) {
        setReports(res.reports);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError(err.message || 'Unable to load skin analysis reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Handle clicking on a report card or icon to view the full report
  const handleOpenReport = (report) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const currentReport = reports.length > 0 ? reports[0] : null;
  const previousReports = reports.length > 1 ? reports.slice(1) : [];

  const getHealthBadge = (score) => {
    const s = Number(score) || 75;
    if (s >= 80) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Optimal' };
    if (s >= 65) return { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Good' };
    if (s >= 45) return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Mild Care' };
    return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Attention' };
  };

  const getConditionColor = (severity) => {
    const s = String(severity || '').toLowerCase();
    if (s.includes('high') || s.includes('severe')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('mod')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent Scan';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12 px-4 sm:px-6 md:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E8DFD8]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#DC926E] bg-[#FAF1EC] border border-[#EFCAAD] px-3 py-1 rounded-full">
                Clinical Diagnostics Log
              </span>
              <span className="text-xs text-[#7A7069] font-medium">
                {reports.length} {reports.length === 1 ? 'Report' : 'Reports'} Archived
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#2B2623] mt-2">
              Skin Health &amp; Analysis Reports
            </h1>
            <p className="text-sm text-[#6B615B] mt-1 max-w-2xl leading-relaxed">
              Visual chronological sequence of your facial optical scans, detected biomarker telemetry, and treatment progressions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={loadReports}
              disabled={loading}
              className="p-2.5 rounded-xl border border-[#E8DFD8] bg-white hover:bg-[#FAF1EC] text-[#5A524C] text-sm font-semibold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh reports"
            >
              <HiOutlineRefresh className={`text-base ${loading ? 'animate-spin text-[#DC926E]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              to="/analysis"
              className="px-4 py-2.5 rounded-xl bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <HiOutlineSparkles className="text-base" />
              <span>New Skin Scan</span>
            </Link>
          </div>
        </div>

        {/* ── Summary Metrics Bar (When reports exist) ── */}
        {reports.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-[#E8DFD8] shadow-xs">
            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A7069] block">
                Total Scans
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#2B2623] mt-0.5 block">
                {reports.length}
              </span>
              <span className="text-[11px] text-[#7A7069]">In patient timeline</span>
            </div>

            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A7069] block">
                Latest Score
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-[#DC926E]">
                  {currentReport?.healthScore ?? 80}
                </span>
                <span className="text-xs font-semibold text-[#7A7069]">/ 100</span>
              </div>
              <span className="text-[11px] text-[#7A7069]">Overall Skin Health</span>
            </div>

            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A7069] block">
                Skin Phenotype
              </span>
              <span className="text-base sm:text-lg font-black text-[#2B2623] mt-1 block truncate">
                {currentReport?.skinType || 'Combination'}
              </span>
              <span className="text-[11px] text-[#7A7069]">Validated Optical</span>
            </div>

            <div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#7A7069] block">
                Latest Scan Date
              </span>
              <span className="text-xs sm:text-sm font-bold text-[#2B2623] mt-1 block truncate">
                {formatDate(currentReport?.createdAt)}
              </span>
              <span className="text-[11px] text-[#7A7069]">{formatTime(currentReport?.createdAt)}</span>
            </div>
          </div>
        )}

        {/* ── Loading Skeleton ── */}
        {loading && (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-3xl border border-[#E8DFD8] animate-pulse space-y-4">
              <div className="h-6 bg-slate-200 rounded w-1/4"></div>
              <div className="h-40 bg-slate-100 rounded-2xl"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="p-5 bg-white rounded-2xl border border-slate-200 animate-pulse space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-24 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {!loading && error && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <HiOutlineExclamationCircle className="text-2xl text-rose-600 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Failed to retrieve analysis reports</h3>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={loadReports}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty State: No reports recorded yet ── */}
        {!loading && !error && reports.length === 0 && (
          <div className="bg-white rounded-3xl border border-[#E8DFD8] p-8 sm:p-14 text-center max-w-xl mx-auto space-y-4 shadow-sm my-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FAF1EC] text-[#DC926E] border border-[#EFCAAD] flex items-center justify-center text-3xl shadow-xs">
              <HiOutlineDocumentReport />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#2B2623]">
              No Skin Analysis Reports Yet
            </h2>
            <p className="text-xs sm:text-sm text-[#7A7069] leading-relaxed max-w-md mx-auto">
              You haven&apos;t completed any skin analysis scans yet. Take your first high-precision face scan to instantly generate your clinical health scorecard and personalized recommendations.
            </p>
            <div className="pt-2">
              <Link
                to="/analysis"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#DC926E] hover:bg-[#c87e5b] text-white text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <HiOutlineSparkles className="text-lg" />
                <span>Start Your First Skin Scan</span>
              </Link>
            </div>
          </div>
        )}

        {/* ── 1. CURRENT / LATEST REPORT (First in sequence) ── */}
        {!loading && !error && currentReport && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#2B2623] flex items-center gap-2">
                <span>1. Current Assessment (Latest Scan)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active Baseline
                </span>
              </h2>
              <span className="text-xs text-[#7A7069]">
                Scanned {formatDate(currentReport.createdAt)}
              </span>
            </div>

            <div className="bg-white border-2 border-[#DC926E]/40 hover:border-[#DC926E] rounded-3xl p-5 sm:p-7 md:p-8 shadow-sm transition-all relative overflow-hidden group">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                
                {/* Left: Thumbnail & Core Identification */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 flex-1 min-w-0">
                  {/* Face Photo Thumbnail with Click Indicator */}
                  <div
                    onClick={() => handleOpenReport(currentReport)}
                    className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-900 border-2 border-[#E8DFD8] overflow-hidden shrink-0 shadow-sm cursor-pointer group-hover:ring-2 group-hover:ring-[#DC926E] transition-all"
                    title="Click to view complete report"
                  >
                    {currentReport.imageUrl && !currentReport.imageUrl.includes('placeholder') ? (
                      <img
                        src={currentReport.imageUrl}
                        alt="Scan Baseline"
                        className="w-full h-full object-cover filter contrast-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center bg-slate-800">
                        <HiOutlineUser className="text-3xl text-slate-500 mb-1" />
                        <span className="text-[10px] font-bold">Face Scan</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                      <HiOutlineEye className="text-base" />
                      <span>View</span>
                    </div>
                    <div className="absolute top-1.5 left-1.5 bg-[#1E293B]/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Latest
                    </div>
                  </div>

                  {/* Identification & Telemetry */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#DC926E] bg-[#FAF1EC] border border-[#EFCAAD] px-2 py-0.5 rounded-md">
                        ID: {String(currentReport._id).slice(-8).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-[#7A7069] flex items-center gap-1">
                        <HiOutlineClock className="text-sm text-[#DC926E]" />
                        <span>{formatDate(currentReport.createdAt)} at {formatTime(currentReport.createdAt)}</span>
                      </span>
                      <span className="text-xs font-bold text-[#2B2623] px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                        Skin: {currentReport.skinType || 'Combination'}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-[#2B2623] truncate">
                      Full-Face Clinical Skin Assessment
                    </h3>

                    {/* Detected Biomarkers Pills (Acne and Pigmentation excluded per instruction) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {(() => {
                        const filtered = (currentReport.predictions || []).filter((p) => {
                          const c = String(p.condition || '').toLowerCase();
                          return !c.includes('acne') && !c.includes('blemish') && !c.includes('pigment');
                        });
                        if (filtered.length === 0) {
                          return (
                            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold">
                              ✓ Balanced Homeostasis &amp; Targeted Cheek Care
                            </span>
                          );
                        }
                        return filtered.map((p, idx) => (
                          <span
                            key={idx}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getConditionColor(p.severity)} flex items-center gap-1`}
                          >
                            <span>{p.condition}:</span>
                            <span className="uppercase">{p.severity}</span>
                            <span className="text-[10px] opacity-75">({p.confidence}%)</span>
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right: Health Score Gauge & Action Button */}
                <div className="flex sm:flex-row lg:flex-col items-center sm:items-center lg:items-end justify-between w-full lg:w-auto gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#F0EBE6]">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-[#7A7069] block">
                        Health Score
                      </span>
                      <span
                        className={`text-xs font-extrabold px-2 py-0.5 rounded-full border inline-block ${
                          getHealthBadge(currentReport.healthScore).bg
                        }`}
                      >
                        {getHealthBadge(currentReport.healthScore).label}
                      </span>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border-2 border-[#DC926E] flex flex-col items-center justify-center font-black text-[#2B2623]">
                      <span className="text-lg leading-tight text-[#DC926E]">
                        {currentReport.healthScore ?? 80}
                      </span>
                      <span className="text-[9px] text-[#7A7069] font-medium">/100</span>
                    </div>
                  </div>

                  {/* Primary Trigger Button: View Report */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReport(currentReport)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2B2623] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                      <HiOutlineDocumentReport className="text-base text-[#DC926E]" />
                      <span>View Full Report</span>
                    </button>
                    <Link
                      to="/recommendations?tab=routine"
                      className="p-2.5 rounded-xl border border-[#E8DFD8] hover:border-[#DC926E] text-[#5A524C] hover:text-[#DC926E] text-xs font-bold transition-all bg-white"
                      title="Open Regimen & Routine"
                    >
                      <HiOutlineSparkles className="text-base text-[#DC926E]" />
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── 2. PREVIOUS HISTORICAL REPORTS (In sequence) ── */}
        {!loading && !error && previousReports.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD8]">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#2B2623]">
                  2. Previous Historical Reports ({previousReports.length})
                </h2>
                <p className="text-xs text-[#7A7069]">
                  Earlier scans arranged in reverse chronological sequence to monitor changes in your skin over time.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previousReports.map((report, idx) => {
                const reportNumber = reports.length - (idx + 1);
                const healthBadge = getHealthBadge(report.healthScore);

                return (
                  <div
                    key={report._id}
                    className="bg-white rounded-2xl border border-[#E8DFD8] hover:border-[#DC926E]/60 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-[#7A7069]">
                          <HiOutlineCalendar className="text-[#DC926E]" />
                          <span className="font-semibold">{formatDate(report.createdAt)}</span>
                          <span>•</span>
                          <span>{formatTime(report.createdAt)}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Scan #{reportNumber}
                        </span>
                      </div>

                      {/* Middle: Thumbnail + Telemetry */}
                      <div className="flex items-start gap-3.5">
                        {/* Scanned Image Icon / Thumbnail */}
                        <div
                          onClick={() => handleOpenReport(report)}
                          className="relative w-20 h-20 rounded-xl bg-slate-900 border border-[#E8DFD8] overflow-hidden shrink-0 cursor-pointer shadow-2xs group-hover:ring-2 group-hover:ring-[#DC926E] transition-all"
                          title="Click on icon to open report"
                        >
                          {report.imageUrl && !report.imageUrl.includes('placeholder') ? (
                            <img
                              src={report.imageUrl}
                              alt="Scan Thumbnail"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-1 text-center bg-slate-800">
                              <HiOutlineUser className="text-2xl text-slate-500 mb-0.5" />
                              <span className="text-[9px]">Photo</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                            <HiOutlineEye className="text-sm" />
                          </div>
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-[#2B2623] truncate">
                              Report: {String(report._id).slice(-8).toUpperCase()}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${healthBadge.bg}`}>
                              {report.healthScore ?? 80}/100
                            </span>
                          </div>

                          <div className="text-[11px] text-[#7A7069]">
                            Phenotype: <strong className="text-[#46352F]">{report.skinType || 'Combination'}</strong>
                          </div>

                          {/* Biomarkers summary */}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {(() => {
                              const filtered = (report.predictions || []).filter((p) => {
                                const c = String(p.condition || '').toLowerCase();
                                return !c.includes('acne') && !c.includes('blemish') && !c.includes('pigment');
                              });
                              if (filtered.length === 0) {
                                return (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Targeted Cheek Care
                                  </span>
                                );
                              }
                              return filtered.slice(0, 3).map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getConditionColor(p.severity)}`}
                                >
                                  {p.condition}: {p.severity}
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer with Icon Button */}
                    <div className="pt-3 border-t border-[#F0EBE6] flex items-center justify-between">
                      <span className="text-[11px] text-[#7A7069]">
                        {report.recommendations?.morningRoutine?.length || 0} AM / {report.recommendations?.nightRoutine?.length || 0} PM Steps
                      </span>

                      {/* Clickable Icon Button to view report */}
                      <button
                        onClick={() => handleOpenReport(report)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FAF1EC] hover:bg-[#DC926E] text-[#DC926E] hover:text-white border border-[#EFCAAD] hover:border-[#DC926E] transition-all cursor-pointer shadow-2xs"
                        title="Click to view full clinical report"
                      >
                        <HiOutlineDocumentReport className="text-sm" />
                        <span>View Report</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Single Historical Report Only Note ── */}
        {!loading && !error && reports.length === 1 && (
          <div className="p-4 rounded-2xl bg-white border border-[#E8DFD8] text-center text-xs text-[#7A7069]">
            This is your first completed assessment. Subsequent scans will automatically appear sequentially under <strong>Previous Historical Reports</strong> for side-by-side progress tracking.
          </div>
        )}

      </div>

      {/* ── Clinical Report Modal (Appears when icon/button is clicked) ── */}
      {selectedReport && (
        <ReportModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedReport(null);
          }}
          reportData={buildReportData({ dbReport: selectedReport, user })}
        />
      )}
    </div>
  );
};

export default Reports;
