// src/components/recommendations/DailyRoutineSection.jsx
import React, { useState, useCallback } from 'react';
import {
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineCheckCircle,
  HiCheckCircle,
  HiOutlineClock,
  HiOutlineShieldCheck,
  HiOutlineInformationCircle,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlineTrash,
  HiOutlineSparkles,
  HiOutlineCheck,
} from 'react-icons/hi';
import ProductImage from '../ProductImage';

const DailyRoutineSection = ({
  routine,
  todayStatus,
  onCompleteStep,
  onTogglePause,
  onRemoveProduct,
  onActivateRoutine,
  onRegenerateRoutine,
  completingStepId = null,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState('morning'); // 'morning' | 'evening'
  const [showPatchTestModal, setShowPatchTestModal] = useState(false);
  // Local completion state: used as a fallback when backend ticks fail (guest mode or in-memory routine)
  const [localCompleted, setLocalCompleted] = useState({ morning: {}, evening: {} });
  const [localProcessing, setLocalProcessing] = useState(null);

  const getStepId = useCallback((step, idx) => {
    return String(step?._id || step?.id || step?.stepNumber || step?.stepOrder || `${activeTab}-${idx}`);
  }, [activeTab]);

  if (loading || (!routine && loading)) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8DFD8] p-6 sm:p-8 space-y-4 animate-pulse">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="h-6 w-56 bg-slate-200 rounded-lg"></div>
          <div className="h-8 w-32 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="h-16 bg-[#FAF8F5] rounded-xl border border-slate-100"></div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-2xl border border-slate-200"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8DFD8] p-8 text-center max-w-xl mx-auto my-8">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-xl mb-3">
          <HiOutlineSun />
        </div>
        <h3 className="text-base font-bold text-[#2B2623] mb-1">No Active Daily Routine</h3>
        <p className="text-xs text-[#7A7069] mb-4">
          Complete a skin analysis to generate your customized morning and evening routine.
        </p>
      </div>
    );
  }

  const isDraft = routine.status === 'draft';
  // Guest/in-memory routines have _isGuest flag: completions are tracked locally only
  const isGuestRoutine = Boolean(routine._isGuest);
  const steps = activeTab === 'morning' ? routine.morningRoutine || [] : routine.eveningRoutine || [];

  // Handle step click: optimistically toggle local state, then try backend sync
  const handleStepClick = async (step, idx) => {
    if (step.isPaused) return;
    const stepId = getStepId(step, idx);
    // Optimistic local toggle
    setLocalCompleted((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [stepId]: !prev[activeTab]?.[stepId],
      },
    }));
    if (!isGuestRoutine && onCompleteStep && routine?._id) {
      setLocalProcessing(stepId);
      try {
        await onCompleteStep(routine._id, activeTab, stepId);
      } catch (err) {
        // Keep local tick even if backend fails
        console.warn('Step completion note:', err?.message);
      } finally {
        setLocalProcessing(null);
      }
    }
  };

  // Calculate completion numbers: prefer backend status, fallback to local state
  const localTabCompleted = localCompleted[activeTab] || {};
  const localCompletedCount = steps.filter((s, idx) => !s.isPaused && localTabCompleted[getStepId(s, idx)]).length;
  const currentStatusObj = activeTab === 'morning' ? todayStatus?.morning : todayStatus?.evening;
  const completedCount = currentStatusObj?.completedCount ?? localCompletedCount;
  const totalCount = currentStatusObj?.totalSteps ?? steps.filter((s) => !s.isPaused).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllDone = currentStatusObj?.isAllCompleted || (totalCount > 0 && completedCount >= totalCount);

  // Status mapping for checkboxes: check backend status first, then local state
  const isStepCompleted = (step, idx) => {
    const stepIdStr = getStepId(step, idx);
    if (activeTab === 'morning') {
      const stepObj = todayStatus?.morning?.steps?.find((s) => String(s._id || s.id || s.stepNumber) === stepIdStr);
      return Boolean(stepObj?.isCompletedToday) || Boolean(localCompleted.morning?.[stepIdStr]);
    } else {
      const stepObj = todayStatus?.evening?.steps?.find((s) => String(s._id || s.id || s.stepNumber) === stepIdStr);
      return Boolean(stepObj?.isCompletedToday) || Boolean(localCompleted.evening?.[stepIdStr]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Draft Review Banner */}
      {isDraft && (
        <div className="bg-gradient-to-r from-[#FAF1EC] to-amber-50 border border-[#EFCAAD] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#DC926E] text-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
              <HiOutlineSparkles />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#2B2623]">
                Review Your Personalized Skincare Regimen
              </h3>
              <p className="text-xs text-[#5A524C] mt-0.5 max-w-xl">
                Inspect your morning and evening application order below. When you're ready, activate this regimen to begin daily tracking and reminders.
              </p>
            </div>
          </div>

          <button
            onClick={() => onActivateRoutine && onActivateRoutine(routine._id)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#2B2623] hover:bg-black text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl shadow transition-all cursor-pointer whitespace-nowrap"
          >
            <HiOutlineCheck className="text-base text-[#DC926E]" />
            <span>Activate Daily Regimen</span>
          </button>
        </div>
      )}

      {/* Routine Tabs and Today's Progress Bar */}
      <div className="bg-white rounded-2xl border border-[#E8DFD8] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* AM / PM Toggle Pills */}
          <div className="flex items-center p-1 bg-[#FAF8F5] rounded-xl border border-[#E8DFD8]">
            <button
              onClick={() => setActiveTab('morning')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'morning'
                  ? 'bg-white text-[#2B2623] shadow-sm'
                  : 'text-[#7A7069] hover:text-[#2B2623]'
              }`}
            >
              <HiOutlineSun className={`text-base ${activeTab === 'morning' ? 'text-amber-500' : ''}`} />
              <span>Morning Routine (AM)</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-semibold">
                {routine.morningRoutine?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('evening')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'evening'
                  ? 'bg-white text-[#2B2623] shadow-sm'
                  : 'text-[#7A7069] hover:text-[#2B2623]'
              }`}
            >
              <HiOutlineMoon className={`text-base ${activeTab === 'evening' ? 'text-indigo-500' : ''}`} />
              <span>Evening Routine (PM)</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-semibold">
                {routine.eveningRoutine?.length || 0}
              </span>
            </button>
          </div>

          {/* Schedule Reminders info & Patch testing link */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowPatchTestModal(!showPatchTestModal)}
              className="text-xs font-semibold text-[#DC926E] hover:text-[#c87e5b] flex items-center gap-1 cursor-pointer"
            >
              <HiOutlineShieldCheck className="text-sm" />
              <span>Patch-Testing Guide</span>
            </button>
          </div>
        </div>

        {/* Patch Test Protocol Drawer */}
        {showPatchTestModal && (
          <div className="bg-[#FAF1EC] border border-[#EFCAAD] rounded-xl p-4 text-xs text-[#46352F] space-y-2 animate-fadeIn">
            <div className="font-bold flex items-center gap-1.5 text-[#2B2623]">
              <HiOutlineShieldCheck className="text-[#DC926E] text-base" />
              <span>Clinical 24-Hour Patch Testing Protocol</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#5A524C]">
              Before applying new active serums or exfoliants to your entire face, apply a pea-sized amount behind your earlobe or on your inner forearm. Monitor for 24 hours for signs of erythema (redness), swelling, burning, or itching. If clear, proceed with facial application.
            </p>
          </div>
        )}

        {/* Today's Completion Progress Bar */}
        <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E8DFD8]/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#2B2623] flex items-center gap-1.5">
              <span>Today's {activeTab === 'morning' ? 'Morning' : 'Evening'} Progress</span>
              {isAllDone && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Completed ✓
                </span>
              )}
            </span>
            <span className="font-semibold text-[#5A524C]">
              {completedCount} of {totalCount} steps completed ({progressPercent}%)
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isAllDone
                  ? 'bg-emerald-500'
                  : activeTab === 'morning'
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Ordered Application Steps List */}
        <div className="space-y-4 pt-2">
          {steps.map((step, idx) => {
            const completed = isStepCompleted(step, idx);
            const isPaused = Boolean(step.isPaused);
            const stepIdStr = getStepId(step, idx);
            const isProcessing = completingStepId === stepIdStr || localProcessing === stepIdStr;

            return (
              <div
                key={stepIdStr}
                className={`rounded-2xl border transition-all p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  completed
                    ? 'bg-emerald-50/40 border-emerald-200 opacity-95'
                    : isPaused
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-[#E8DFD8] hover:border-[#DC926E]/60 shadow-xs'
                }`}
              >
                {/* Left: Step Number & Checkbox & Thumbnail */}
                <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 flex-1">
                  {/* Completion Checkbox */}
                  <button
                    onClick={() => !isPaused && handleStepClick(step, idx)}
                    disabled={isPaused || isProcessing}
                    className={`mt-1 sm:mt-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                      completed
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isPaused
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'border-2 border-slate-300 hover:border-[#DC926E] text-transparent hover:text-slate-300'
                    }`}
                    title={completed ? 'Completed for today' : 'Click to mark step as completed'}
                  >
                    <HiCheckCircle className="text-xl" />
                  </button>

                  {/* Step Order Badge */}
                  <div className="w-7 h-7 rounded-lg bg-[#FAF1EC] text-[#46352F] border border-[#EFCAAD] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {step.stepNumber}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-14 h-14 bg-[#FAF8F5] rounded-xl border border-[#E8DFD8] p-1.5 flex items-center justify-center flex-shrink-0">
                    <ProductImage
                      imageUrl={step.productImage}
                      name={step.productName}
                      brand={step.brand}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* Step Description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#DC926E]">
                        {step.stepName}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {step.category}
                      </span>
                      {step.waitingTimeMinutes > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <HiOutlineClock />
                          <span>Wait {step.waitingTimeMinutes} min</span>
                        </span>
                      )}
                      {isPaused && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-200 text-slate-600">
                          Paused
                        </span>
                      )}
                    </div>

                    <h4
                      className={`text-sm font-bold text-[#2B2623] ${
                        completed ? 'line-through text-slate-500' : ''
                      }`}
                    >
                      {step.brand} — {step.productName}
                    </h4>

                    <p className="text-xs text-[#5A524C] leading-relaxed max-w-2xl">
                      {step.applicationInstructions}
                    </p>

                    <div className="text-[11px] text-[#7A7069] flex items-center gap-2 pt-0.5">
                      <span className="font-medium">Frequency:</span>
                      <span>{step.frequency}</span>
                    </div>
                  </div>
                </div>

                {/* Right Actions: Pause / Remove controls */}
                <div className="flex items-center gap-2 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                  <button
                    onClick={() =>
                      onTogglePause &&
                      onTogglePause(routine._id, step.product, !step.isPaused)
                    }
                    className="p-1.5 text-xs text-slate-500 hover:text-[#2B2623] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title={step.isPaused ? 'Resume product in routine' : 'Pause product'}
                  >
                    {step.isPaused ? <HiOutlinePlay className="text-sm" /> : <HiOutlinePause className="text-sm" />}
                    <span className="hidden sm:inline">{step.isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${step.productName} from your ${activeTab} routine?`)) {
                        onRemoveProduct && onRemoveProduct(routine._id, step.product);
                      }
                    }}
                    className="p-1.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Remove from routine"
                  >
                    <HiOutlineTrash className="text-sm" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DailyRoutineSection;
