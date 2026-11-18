// src/components/recommendations/ToastNotification.jsx
import React, { useEffect } from 'react';
import {
  HiCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiX,
} from 'react-icons/hi';

const ToastNotification = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, toast.duration || 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success' || !toast.type;
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-fadeIn">
      <div
        className={`rounded-2xl border p-4 shadow-xl flex items-center justify-between gap-3 text-sm ${
          isSuccess
            ? 'bg-emerald-950 text-white border-emerald-800'
            : isError
            ? 'bg-rose-950 text-white border-rose-800'
            : 'bg-[#1E293B] text-white border-slate-700'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isSuccess && <HiCheckCircle className="text-emerald-400 text-xl flex-shrink-0" />}
          {isError && <HiOutlineExclamationCircle className="text-rose-400 text-xl flex-shrink-0" />}
          {!isSuccess && !isError && <HiOutlineInformationCircle className="text-blue-400 text-xl flex-shrink-0" />}
          <span className="font-medium text-xs sm:text-sm">{toast.message}</span>
        </div>

        <button
          onClick={onClose}
          className="text-white/60 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <HiX className="text-base" />
        </button>
      </div>
    </div>
  );
};

export default ToastNotification;
