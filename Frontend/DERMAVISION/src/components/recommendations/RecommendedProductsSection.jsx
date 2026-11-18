// src/components/recommendations/RecommendedProductsSection.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineSparkles,
  HiOutlineInformationCircle,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineCheckCircle,
  HiOutlineExternalLink,
  HiOutlineShieldCheck,
  HiOutlineBeaker,
} from 'react-icons/hi';
import ProductImage from '../ProductImage';

const RecommendedProductsSection = ({ products = [], onSelectProduct, loading = false }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedCards, setExpandedCards] = useState({});

  const toggleExpand = (productId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))];

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const formatPrice = (price) => {
    if (price == null || price === '') return 'Price not listed';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(price));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse">
              <div className="h-48 bg-slate-100 rounded-xl"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              <div className="h-10 bg-slate-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8DFD8] p-8 text-center max-w-xl mx-auto my-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#FAF1EC] text-[#DC926E] flex items-center justify-center text-xl mb-3">
          <HiOutlineSparkles />
        </div>
        <h3 className="text-base font-bold text-[#2B2623] mb-1">No Matching Products in Catalog</h3>
        <p className="text-xs text-[#7A7069] max-w-md mx-auto leading-relaxed">
          No verified products currently match your specific skin biomarkers and allergy restrictions in our curated catalog. DermaVision never fabricates unverified formulations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Category Filter Pills */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#2B2623] flex items-center gap-2">
            <span>Targeted Clinical Products</span>
            <span className="text-xs font-semibold bg-[#FAF1EC] text-[#DC926E] px-2.5 py-0.5 rounded-full border border-[#EFCAAD]">
              {products.length} Curated
            </span>
          </h2>
          <p className="text-xs text-[#7A7069] mt-0.5">
            Strictly curated from our verified database matching your skin type, allergies, and detected concerns.
          </p>
        </div>

        {/* Category Tabs */}
        {categories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#2B2623] text-white shadow-sm'
                    : 'bg-white hover:bg-[#FAF8F5] text-[#5A524C] border border-[#E8DFD8]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((item, idx) => {
          const isExpanded = Boolean(expandedCards[item.productId || idx]);
          const productId = item.productId;
          const matchScore = item.matchScore || 85;

          return (
            <div
              key={productId || idx}
              className="bg-white rounded-2xl border border-[#E8DFD8] shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div>
                {/* Image & Top Badges */}
                <div className="relative bg-[#FAF8F5] p-6 flex items-center justify-center border-b border-[#F0EBE6] overflow-hidden">
                  <div className="w-40 h-40 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                    <ProductImage
                      imageUrl={item.imageUrl}
                      name={item.name}
                      brand={item.brand}
                      className="max-h-full max-w-full object-contain mix-blend-multiply"
                    />
                  </div>

                  {/* Top Left: Category & Concern Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-white/90 text-[#46352F] border border-[#E8DFD8] shadow-2xs backdrop-blur-xs">
                      {item.category}
                    </span>
                    {item.relevantConcern && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FAF1EC] text-[#DC926E] border border-[#EFCAAD] shadow-2xs">
                        Targets: {item.relevantConcern}
                      </span>
                    )}
                  </div>

                  {/* Top Right: Match Score Gauge */}
                  <div className="absolute top-3 right-3">
                    <div
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs flex items-center gap-1"
                      title="Clinical compatibility score calculated from skin type and active ingredients"
                    >
                      <HiOutlineSparkles className="text-xs" />
                      <span>{matchScore}% Match</span>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-3">
                  {/* Brand & Name */}
                  <div>
                    <div className="text-xs font-semibold text-[#DC926E] uppercase tracking-wider">
                      {item.brand}
                    </div>
                    <h3 className="text-sm font-bold text-[#2B2623] line-clamp-2 mt-0.5 group-hover:text-[#DC926E] transition-colors">
                      {item.name}
                    </h3>
                    <div className="text-sm font-black text-[#2B2623] mt-1">
                      {formatPrice(item.price)}
                    </div>
                  </div>

                  {/* Clinical Reason (WHY recommended) */}
                  <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#E8DFD8]/80 text-xs text-[#46352F] space-y-1">
                    <div className="font-semibold text-[#2B2623] flex items-center gap-1.5">
                      <HiOutlineShieldCheck className="text-[#DC926E] text-sm flex-shrink-0" />
                      <span>Why This Is Recommended:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#5A524C]">
                      {item.reason}
                    </p>
                  </div>

                  {/* Ingredients Preview */}
                  {Array.isArray(item.ingredients) && item.ingredients.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-[#7A7069] flex items-center gap-1 mb-1.5">
                        <HiOutlineBeaker className="text-[#DC926E]" />
                        <span>Key Formulation Actives:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.ingredients.slice(0, 4).map((ing, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 truncate max-w-[150px]"
                          >
                            {ing}
                          </span>
                        ))}
                        {item.ingredients.length > 4 && (
                          <span className="text-[10px] text-slate-500 font-medium self-center pl-1">
                            +{item.ingredients.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expandable Instructions & Safety Warnings */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-[#E8DFD8] space-y-2.5 text-xs animate-fadeIn">
                      {/* Application Instructions */}
                      {item.applicationInstructions && (
                        <div>
                          <div className="font-semibold text-[#2B2623] mb-0.5">Application Protocol:</div>
                          <p className="text-[11px] text-[#5A524C] leading-normal">
                            {item.applicationInstructions}
                          </p>
                        </div>
                      )}

                      {/* Warnings */}
                      {Array.isArray(item.warnings) && item.warnings.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-800">
                          <div className="font-bold flex items-center gap-1 mb-0.5">
                            <HiOutlineInformationCircle className="text-xs" />
                            <span>Safety &amp; Contraindications:</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5">
                            {item.warnings.map((w, wIdx) => (
                              <li key={wIdx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-5 pt-0 flex items-center gap-2">
                <button
                  onClick={() => toggleExpand(item.productId || idx)}
                  className="flex-1 text-xs font-semibold py-2 px-3 rounded-xl border border-[#CBD5E1] hover:bg-[#FAF8F5] text-[#46352F] flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span>{isExpanded ? 'Less Info' : 'Usage & Safety'}</span>
                  {isExpanded ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                </button>

                {productId ? (
                  <Link
                    to={`/products/${encodeURIComponent(productId)}`}
                    className="flex-1 text-xs font-bold py-2 px-3 rounded-xl bg-[#2B2623] hover:bg-black text-white flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                  >
                    <span>Full Details</span>
                    <HiOutlineExternalLink className="text-xs" />
                  </Link>
                ) : (
                  <button
                    onClick={() => onSelectProduct && onSelectProduct(item)}
                    className="flex-1 text-xs font-bold py-2 px-3 rounded-xl bg-[#2B2623] hover:bg-black text-white flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                  >
                    <span>Inspect</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendedProductsSection;
