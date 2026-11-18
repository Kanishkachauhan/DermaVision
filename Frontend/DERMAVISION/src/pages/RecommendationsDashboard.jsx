// src/pages/RecommendationsDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  HiOutlineSparkles,
  HiOutlineSun,
  HiOutlineClock,
  HiOutlineRefresh,
  HiOutlineDocumentReport,
  HiOutlineExclamationCircle,
  HiOutlineShieldCheck,
  HiOutlineViewGrid,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import {
  fetchMyRecommendations,
  fetchActiveRoutineApi,
  fetchTodayRoutineStatusApi,
  activateRoutineApi,
  completeRoutineStepApi,
  toggleProductPauseApi,
  removeProductFromRoutineApi,
  regenerateRoutineApi,
  fetchMyReportsApi,
} from '../utils/api';
import { buildReportData } from '../utils/reportGenerator';

import SkinAnalysisSummaryCard from '../components/recommendations/SkinAnalysisSummaryCard';
import RecommendedProductsSection from '../components/recommendations/RecommendedProductsSection';
import DailyRoutineSection from '../components/recommendations/DailyRoutineSection';
import RecommendationHistorySection from '../components/recommendations/RecommendationHistorySection';
import ProductQuickViewModal from '../components/recommendations/ProductQuickViewModal';
import ToastNotification from '../components/recommendations/ToastNotification';
import ReportModal from '../components/ReportModal';

const RecommendationsDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Main Tab: 'routine' | 'products' | 'history'
  const initialTab = searchParams.get('tab') || 'routine';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRecommendation, setActiveRecommendation] = useState(null);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [latestReport, setLatestReport] = useState(null);
  const [historyList, setHistoryList] = useState([]);

  // UI Interactive States
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [completingStepId, setCompletingStepId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Master Data Fetcher
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Reports & Recommendations & Active Routine in parallel
      const [reportsRes, recsRes, routineRes] = await Promise.allSettled([
        fetchMyReportsApi(1, 5),
        fetchMyRecommendations(1, 10),
        fetchActiveRoutineApi(),
      ]);

      // Handle Latest Report
      if (reportsRes.status === 'fulfilled' && reportsRes.value?.reports?.length > 0) {
        setLatestReport(reportsRes.value.reports[0]);
      }

      // Handle Recommendations
      let currentRec = null;
      if (recsRes.status === 'fulfilled' && recsRes.value?.recommendations) {
        const list = recsRes.value.recommendations;
        setHistoryList(list);
        currentRec = list.find((r) => r.status === 'active') || list[0] || null;
        setActiveRecommendation(currentRec);
      }

      // Handle Routine & Today's Status
      if (routineRes.status === 'fulfilled' && routineRes.value?.data) {
        const routine = routineRes.value.data;
        setActiveRoutine(routine);

        // Fetch today's completion progress
        try {
          const statusRes = await fetchTodayRoutineStatusApi(routine._id);
          if (statusRes.data) {
            setTodayStatus(statusRes.data);
          }
        } catch (statusErr) {
          console.warn('[Dashboard] Could not fetch today status:', statusErr.message);
        }
      }
    } catch (err) {
      console.error('[RecommendationsDashboard] Loading failed:', err);
      setError(err.message || 'Failed to load recommendation data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, loadDashboardData]);

  // ── Step Completion Handler ──────────────────────────────────────────────
  const handleCompleteStep = async (routineId, timeOfDay, stepId) => {
    setCompletingStepId(stepId);
    try {
      const res = await completeRoutineStepApi(routineId, {
        timeOfDay,
        stepId,
      });

      if (res.success) {
        showToast('Step completed for today! Great job maintaining your regimen.');
        // Refresh today status
        const updatedStatus = await fetchTodayRoutineStatusApi(routineId);
        if (updatedStatus.data) {
          setTodayStatus(updatedStatus.data);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to record step completion.', 'error');
    } finally {
      setCompletingStepId(null);
    }
  };

  // ── Routine Activation Handler ────────────────────────────────────────────
  const handleActivateRoutine = async (routineId) => {
    try {
      const res = await activateRoutineApi(routineId);
      if (res.success && res.data) {
        setActiveRoutine(res.data);
        showToast('Your personalized daily regimen is now active! Schedule reminders started.');
        // Reload today status
        const updatedStatus = await fetchTodayRoutineStatusApi(routineId);
        if (updatedStatus.data) {
          setTodayStatus(updatedStatus.data);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to activate routine.', 'error');
    }
  };

  // ── Product Pause / Resume Handler ───────────────────────────────────────
  const handleTogglePause = async (routineId, productId, isPaused) => {
    try {
      const res = await toggleProductPauseApi(routineId, productId, isPaused);
      if (res.success && res.data) {
        setActiveRoutine(res.data);
        showToast(`Product ${isPaused ? 'paused' : 'resumed'} in your routine.`);
        const updatedStatus = await fetchTodayRoutineStatusApi(routineId);
        if (updatedStatus.data) {
          setTodayStatus(updatedStatus.data);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to update product status.', 'error');
    }
  };

  // ── Remove Product Handler ────────────────────────────────────────────────
  const handleRemoveProduct = async (routineId, productId) => {
    try {
      const res = await removeProductFromRoutineApi(routineId, productId);
      if (res.success && res.data) {
        setActiveRoutine(res.data);
        showToast('Product removed and routine re-sequenced.');
        const updatedStatus = await fetchTodayRoutineStatusApi(routineId);
        if (updatedStatus.data) {
          setTodayStatus(updatedStatus.data);
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove product.', 'error');
    }
  };

  // ── Select Previous Recommendation ────────────────────────────────────────
  const handleSelectRecommendation = (rec) => {
    setActiveRecommendation(rec);
    if (rec.skincareRoutine) {
      setActiveRoutine(rec.skincareRoutine);
    }
    setActiveTab('products');
    showToast('Loaded clinical formulation regimen.');
  };

  // Build reportData for full modal preview
  const reportModalData = latestReport
    ? buildReportData({
        analysisResult: latestReport,
        user,
      })
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* ══ 1. TOP HEADER & METRICS ══ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E8DFD8] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#DC926E] bg-[#FAF1EC] px-3 py-1 rounded-full border border-[#EFCAAD]">
              Personalized Dermatology AI
            </span>
            <span className="text-xs text-[#7A7069]">Evidence-Based Regimen</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2B2623] tracking-tight">
            Skincare Recommendations &amp; Daily Routine
          </h1>
          <p className="text-xs sm:text-sm text-[#7A7069] mt-1 max-w-2xl">
            Custom-formulated product recommendations and application schedules calibrated to your exact skin type and detected concerns.
          </p>
        </div>

        {/* Top Action Pills */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#2B2623] border border-[#CBD5E1] transition-all cursor-pointer shadow-2xs"
            title="Refresh dashboard data"
          >
            <HiOutlineRefresh className={`text-sm ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <Link
            to="/analysis"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-[#DC926E] hover:bg-[#c87e5b] text-white shadow-sm transition-all cursor-pointer"
          >
            <HiOutlineSparkles className="text-sm" />
            <span>New Skin Scan</span>
          </Link>
        </div>
      </div>

      {/* ══ 2. ERROR STATE ══ */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 text-xs sm:text-sm text-rose-800 flex items-start gap-3">
          <HiOutlineExclamationCircle className="text-lg sm:text-xl text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Error Loading Skincare Data</div>
            <div className="mt-0.5 opacity-90">{error}</div>
          </div>
          <button
            onClick={loadDashboardData}
            className="underline font-semibold hover:text-rose-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ══ 3. LATEST SKIN ANALYSIS SUMMARY CARD ══ */}
      <SkinAnalysisSummaryCard
        report={latestReport}
        onOpenReportModal={() => setShowReportModal(true)}
      />

      {/* ══ 4. MAIN NAVIGATION TABS ══ */}
      <div className="border-b border-[#E8DFD8] flex items-center gap-2 overflow-x-auto pb-0">
        <button
          onClick={() => handleTabChange('routine')}
          className={`flex items-center gap-2 pb-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'routine'
              ? 'border-[#DC926E] text-[#DC926E]'
              : 'border-transparent text-[#7A7069] hover:text-[#2B2623]'
          }`}
        >
          <HiOutlineSun className="text-base" />
          <span>Daily Routine Schedule</span>
          {activeRoutine && (
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              Active
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('products')}
          className={`flex items-center gap-2 pb-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-[#DC926E] text-[#DC926E]'
              : 'border-transparent text-[#7A7069] hover:text-[#2B2623]'
          }`}
        >
          <HiOutlineViewGrid className="text-base" />
          <span>Recommended Products</span>
          {activeRecommendation?.selectedProducts?.length > 0 && (
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#FAF1EC] text-[#DC926E] font-semibold border border-[#EFCAAD]">
              {activeRecommendation.selectedProducts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('history')}
          className={`flex items-center gap-2 pb-3.5 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-[#DC926E] text-[#DC926E]'
              : 'border-transparent text-[#7A7069] hover:text-[#2B2623]'
          }`}
        >
          <HiOutlineClock className="text-base" />
          <span>Regimen History</span>
          {historyList.length > 0 && (
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              {historyList.length}
            </span>
          )}
        </button>
      </div>

      {/* ══ 5. TAB CONTENT PANELS ══ */}
      <div>
        {activeTab === 'routine' && (
          <DailyRoutineSection
            routine={activeRoutine}
            todayStatus={todayStatus}
            onCompleteStep={handleCompleteStep}
            onTogglePause={handleTogglePause}
            onRemoveProduct={handleRemoveProduct}
            onActivateRoutine={handleActivateRoutine}
            completingStepId={completingStepId}
          />
        )}

        {activeTab === 'products' && (
          <RecommendedProductsSection
            products={
              activeRecommendation?.formattedProducts ||
              activeRecommendation?.selectedProducts?.map((sp) => {
                const prod = sp.product || {};
                return {
                  productId: prod._id || prod.id,
                  name: prod.name,
                  brand: prod.brand,
                  imageUrl: prod.imageUrl,
                  category: prod.category || sp.stepName,
                  price: prod.price,
                  relevantConcern: (sp.targetedConcerns && sp.targetedConcerns[0]) || sp.stepName,
                  reason: sp.primaryReason,
                  ingredients: prod.ingredients,
                  applicationInstructions: sp.usageTip || prod.usageInstructions?.join(' '),
                  warnings: prod.warnings,
                  matchScore: sp.matchScore || 85,
                };
              }) || []
            }
            onSelectProduct={(p) => setSelectedProductForModal(p)}
            loading={loading}
          />
        )}

        {activeTab === 'history' && (
          <RecommendationHistorySection
            recommendations={historyList}
            activeRecommendationId={activeRecommendation?._id}
            onSelectRecommendation={handleSelectRecommendation}
          />
        )}
      </div>

      {/* ══ 6. MODALS & NOTIFICATIONS ══ */}
      {/* Product QuickView Modal */}
      <ProductQuickViewModal
        product={selectedProductForModal}
        isOpen={Boolean(selectedProductForModal)}
        onClose={() => setSelectedProductForModal(null)}
      />

      {/* Full Clinical Report Modal */}
      {showReportModal && reportModalData && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportData={reportModalData}
        />
      )}

      {/* Toast Notification */}
      <ToastNotification
        toast={toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
};

export default RecommendationsDashboard;
