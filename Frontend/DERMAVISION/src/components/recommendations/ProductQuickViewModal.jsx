// src/components/recommendations/ProductQuickViewModal.jsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HiX,
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineBeaker,
  HiOutlineClock,
  HiOutlineInformationCircle,
  HiOutlineExternalLink,
} from 'react-icons/hi';
import ProductImage from '../ProductImage';

const ProductQuickViewModal = ({ product, isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const formatPrice = (price) => {
    if (price == null || price === '') return 'Price not listed by manufacturer';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(price));
  };

  const ingredientsList = Array.isArray(product.ingredients)
    ? product.ingredients.map((i) => (typeof i === 'string' ? i : i.name)).filter(Boolean)
    : [];

  const warnings = Array.isArray(product.warnings) && product.warnings.length > 0
    ? product.warnings
    : Array.isArray(product.precautions) && product.precautions.length > 0
    ? product.precautions
    : ['For external cosmetic use only. Avoid contact with broken skin or eyes.'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-[#E8DFD8] overflow-hidden max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD8] bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FAF1EC] text-[#DC926E] border border-[#EFCAAD]">
              {product.category || 'Clinical Formula'}
            </span>
            <span className="text-xs text-[#7A7069]">Verified Product Details</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#7A7069] hover:text-[#2B2623] hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <HiX className="text-xl" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: Large Image Container */}
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#E8DFD8] p-8 flex items-center justify-center h-64 sm:h-80">
              <ProductImage
                imageUrl={product.imageUrl}
                name={product.name}
                brand={product.brand}
                className="max-h-full max-w-full object-contain mix-blend-multiply"
              />
            </div>

            {/* Right: Essential Info */}
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#DC926E]">
                  {product.brand}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#2B2623] leading-snug mt-1">
                  {product.name}
                </h2>
                <div className="text-lg font-black text-[#2B2623] mt-2">
                  {formatPrice(product.price)}
                </div>
              </div>

              {/* Clinical Why Reason */}
              {product.reason && (
                <div className="bg-[#FAF1EC] border border-[#EFCAAD] rounded-xl p-3.5 text-xs text-[#46352F] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[#2B2623]">
                    <HiOutlineShieldCheck className="text-[#DC926E] text-base" />
                    <span>Clinical Recommendation Rationale:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#5A524C]">
                    {product.reason}
                  </p>
                </div>
              )}

              {/* Target Concerns & Skin Types */}
              <div className="space-y-2 text-xs">
                {product.relevantConcern && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#7A7069]">Primary Target:</span>
                    <span className="font-bold text-[#DC926E]">{product.relevantConcern}</span>
                  </div>
                )}
                {product.matchScore && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#7A7069]">Compatibility Match:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {product.matchScore}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Application Instructions */}
          {product.applicationInstructions && (
            <div className="space-y-1.5 pt-2 border-t border-[#E8DFD8]">
              <h4 className="text-xs font-bold text-[#2B2623] uppercase tracking-wider flex items-center gap-1.5">
                <HiOutlineClock className="text-[#DC926E]" />
                <span>Application Instructions:</span>
              </h4>
              <p className="text-xs text-[#5A524C] leading-relaxed bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E8DFD8]">
                {product.applicationInstructions}
              </p>
            </div>
          )}

          {/* Full Ingredients Breakdown */}
          {ingredientsList.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E8DFD8]">
              <h4 className="text-xs font-bold text-[#2B2623] uppercase tracking-wider flex items-center gap-1.5">
                <HiOutlineBeaker className="text-[#DC926E]" />
                <span>Complete Formulation Ingredients:</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {ingredientsList.map((ing, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Safety Information */}
          <div className="space-y-1.5 pt-2 border-t border-[#E8DFD8]">
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <HiOutlineInformationCircle />
              <span>Safety Information &amp; Precautions:</span>
            </h4>
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {warnings.map((w, wIdx) => (
                  <li key={wIdx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#E8DFD8] bg-[#FAF8F5] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-[#CBD5E1] hover:bg-white text-[#46352F] transition-all cursor-pointer"
          >
            Close
          </button>

          {product.productId && (
            <Link
              to={`/products/${encodeURIComponent(product.productId)}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl bg-[#2B2623] hover:bg-black text-white shadow-sm transition-all cursor-pointer"
            >
              <span>View Product Page</span>
              <HiOutlineExternalLink className="text-sm" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductQuickViewModal;
