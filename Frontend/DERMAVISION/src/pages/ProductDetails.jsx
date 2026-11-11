import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiBadgeCheck,
  HiOutlineBeaker,
  HiOutlineClock,
  HiOutlineExclamation,
  HiOutlineInformationCircle,
  HiOutlineShieldCheck,
  HiStar,
} from "react-icons/hi";
import ProductImage from "../components/ProductImage";
import { apiRequest } from "../utils/api";

const formatPrice = (price, currency = "INR") => {
  if (price == null || Number(price) === 0) return "Price not listed by manufacturer";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
};

const asTextList = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];

const getAvailabilityValue = (value) => {
  const availability = typeof value === "string" ? value.trim() : "";
  return availability && !/^(information not available|not available)$/i.test(availability)
    ? availability
    : "Stock status not published by manufacturer";
};

const ProductDetails = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relatedError, setRelatedError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchProduct = async () => {
      setLoading(true);
      setProduct(null);
      setRelatedProducts([]);
      setRelatedError("");
      setError("");

      try {
        const data = await apiRequest(`/products/${encodeURIComponent(productId)}`);
        if (cancelled) return;
        if (!data.product) {
          const notFound = new Error("Product not found.");
          notFound.status = 404;
          throw notFound;
        }
        setProduct(data.product);

        try {
          const related = await apiRequest(
            `/products?brand=${encodeURIComponent(data.product.brand)}&limit=4`
          );
          if (!cancelled) {
            const relatedItems = (related.products || [])
              .filter((item) => String(item._id || item.id) !== String(data.product._id || data.product.id))
              .slice(0, 4);
            setRelatedProducts(relatedItems);
          }
        } catch (relatedRequestError) {
          if (!cancelled) {
            setRelatedError(relatedRequestError.message || "Related products are unavailable.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError({
            message: err.message || "Unable to load the product details.",
            status: err.status || 0,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (productId) fetchProduct();

    return () => {
      cancelled = true;
    };
  }, [productId, retryKey]);

  const detailSections = useMemo(() => {
    if (!product) return [];

    const aiContent = product.aiGeneratedContent;
    const aiSkinGoals = aiContent?.skinGoals || {};
    const aiHowToUse = aiContent?.howToUse || {};
    const getContentItem = (field, aiValue, fallback) => {
      const verifiedValue = asTextList(product[field]);
      if (verifiedValue.length) {
        return {
          value: verifiedValue.join(" • "),
          source:
            product.contentSource?.[field] === "manufacturer"
              ? "Manufacturer information"
              : "Product record",
        };
      }
      if (asTextList(aiValue).length) {
        return {
          value: asTextList(aiValue).join(" • "),
          source: "AI-generated skincare guidance",
        };
      }
      return { value: fallback, source: "General guidance" };
    };
    const goals = {
      targetConcerns: getContentItem(
        "targetConcerns",
        aiSkinGoals.targetConcerns?.length
          ? aiSkinGoals.targetConcerns
          : product.targetConditions,
        "Check the product label for its stated skin concerns."
      ),
      suitableSkinTypes: getContentItem(
        "suitableSkinTypes",
        aiSkinGoals.suitableSkinTypes?.length
          ? aiSkinGoals.suitableSkinTypes
          : product.skinTypes,
        "Skin-type suitability is not specified; follow the product label."
      ),
      benefits: getContentItem(
        "benefits",
        aiSkinGoals.benefits,
        "Refer to the manufacturer's product description."
      ),
      instructions: getContentItem(
        "usageInstructions",
        aiHowToUse.instructions,
        "Follow the manufacturer's instructions on the product packaging."
      ),
      precautions: getContentItem(
        "precautions",
        aiHowToUse.precautions,
        "Check the packaging for product-specific warnings and patch-test new products."
      ),
    };
    const verifiedTiming = asTextList(product.usageInstructions).find((line) =>
      /morning|evening|day|night/i.test(line)
    );
    const timing = verifiedTiming
      ? {
          value: verifiedTiming,
          source:
            product.contentSource?.usageInstructions === "manufacturer"
              ? "Manufacturer information"
              : "Product record",
        }
      : aiHowToUse.timeOfUse
        ? { value: aiHowToUse.timeOfUse, source: "AI-generated skincare guidance" }
        : { value: "Follow the product label for timing.", source: "General guidance" };

    return [
      {
        title: "Product Overview",
        items: [
          { label: "Brand", value: product.brand || "Not listed" },
          { label: "Category", value: product.category || "Not listed" },
          { label: "Size", value: product.productSize || "Not listed by manufacturer" },
          { label: "Availability", value: getAvailabilityValue(product.availability) },
          { label: "Price", value: formatPrice(product.price, product.currency) },
          { label: "Official source", value: product.officialSourceUrl ? "View official source" : "No manufacturer link provided", link: product.officialSourceUrl || null },
        ],
      },
      {
        title: "Skin Goals",
        items: [
          { label: "Target concerns", ...goals.targetConcerns },
          { label: "Suitable skin types", ...goals.suitableSkinTypes },
          { label: "Benefits", ...goals.benefits },
        ],
      },
      {
        title: "How to Use",
        items: [
          { label: "Instructions", ...goals.instructions },
          { label: "Time of use", ...timing },
          { label: "Precautions", ...goals.precautions },
        ],
      },
    ];
  }, [product]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
        <div className="animate-pulse rounded-3xl border border-[#EDE3DC] bg-white p-6 shadow-sm">
          <div className="h-5 w-32 rounded bg-[#F2E7E0]" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
            <div className="h-[420px] rounded-[2rem] bg-[#F5EAE3]" />
            <div className="space-y-4">
              <div className="h-7 w-3/5 rounded bg-[#F5EAE3]" />
              <div className="h-4 w-1/3 rounded bg-[#F5EAE3]" />
              <div className="h-24 rounded bg-[#F5EAE3]" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-16 rounded bg-[#F5EAE3]" />
                <div className="h-16 rounded bg-[#F5EAE3]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    const isNotFound = error.status === 404;
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <HiOutlineExclamation className="mx-auto text-4xl text-red-500" />
          <h1 className="mt-4 text-2xl font-semibold text-[#46352F]">
            {isNotFound ? "Product not found" : "Unable to load product details"}
          </h1>
          <p className="mt-3 text-sm text-[#6C6058]">
            {error.message || "We could not load this product right now."}
          </p>
          {!isNotFound && (
            <button
              type="button"
              onClick={() => setRetryKey((key) => key + 1)}
              className="mt-6 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-[#76533F] hover:bg-red-50"
            >
              Try again
            </button>
          )}
          <Link
            to="/products"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#DC926E] px-5 py-3 text-sm font-semibold text-white"
          >
            <HiArrowLeft /> Back to products
          </Link>
        </div>
      </div>
    );
  }

  const ingredientList = product.ingredients || [];

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
      <div className="mb-8 flex items-center justify-between">
        <Link to="/products" className="inline-flex items-center gap-2 rounded-full border border-[#EADCCF] bg-white px-4 py-2 text-sm font-medium text-[#5E4840] hover:border-[#DC926E] hover:text-[#A26548]">
          <HiArrowLeft className="text-base" /> Back to Products
        </Link>
        {product.lastVerifiedAt && (
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F8F1EC] px-3 py-1.5 text-[11px] font-medium text-[#7F655C]">
            <HiOutlineClock className="text-sm" /> Last verified {new Date(product.lastVerifiedAt).toLocaleDateString("en-IN")}
          </div>
        )}
      </div>

      <article className="overflow-hidden rounded-[2rem] border border-[#EDE3DC] bg-white shadow-[0_18px_50px_-40px_rgba(70,53,47,0.4)]">
        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[0.92fr_1.08fr] lg:p-10">
          <div className="overflow-hidden rounded-[1.8rem] border border-[#F0E9E4] bg-[#F9F1ED] p-4">
            <ProductImage
              imageUrl={product.imageUrl}
              name={product.name}
              brand={product.brand}
              loading="eager"
              className="h-full min-h-[380px] w-full rounded-[1.4rem] object-contain"
            />
          </div>

          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#EDCBB4] bg-[#FFF8F3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A6B55]">
              <HiBadgeCheck className="text-sm" /> {product.brand || "Brand"}
            </div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-[#46352F] sm:text-4xl">{product.name}</h1>
            <p className="mt-3 text-sm leading-6 text-[#70635D]">
              {product.description || "See the product information below for intended use and general guidance."}
            </p>
            {product.description && (
              <span className="mt-2 inline-flex w-fit rounded-full bg-[#F8F1EC] px-2.5 py-1 text-[10px] font-medium text-[#7F655C]">
                {product.contentSource?.description === "manufacturer"
                  ? "Manufacturer information"
                  : "Catalog information"}
              </span>
            )}
            {product.aiGeneratedContent?.description && (
              <div className="mt-4 rounded-2xl border border-[#EADCCF] bg-[#FFFAF6] p-4">
                <span className="inline-flex rounded-full bg-[#F3E4D9] px-2.5 py-1 text-[10px] font-semibold text-[#865E47]">
                  AI-generated skincare guidance
                </span>
                <p className="mt-2 text-sm leading-6 text-[#70635D]">
                  {product.aiGeneratedContent.description}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-2xl font-semibold text-[#46352F]">{formatPrice(product.price, product.currency)}</span>
              <span className="rounded-full bg-[#F6E7DE] px-3 py-1 text-[11px] font-medium text-[#A36C53]">{product.category || "Category"}</span>
              {product.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8EC] px-3 py-1 text-[11px] font-medium text-[#7A5A32]">
                  <HiStar className="text-sm text-[#D99A45]" /> {Number(product.rating).toFixed(1)}
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#F0E6E0] bg-[#FAF6F3] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A38F83]">Availability</p>
                <p className="mt-2 text-sm font-medium text-[#46352F]">
                  {getAvailabilityValue(product.availability)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#F0E6E0] bg-[#FAF6F3] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A38F83]">Product size</p>
                <p className="mt-2 text-sm font-medium text-[#46352F]">{product.productSize || "Size not listed by manufacturer"}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {product.officialSourceUrl && (
                <a
                  href={product.officialSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#46352F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2E2522]"
                >
                  Official product source
                </a>
              )}
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E7D7CD] bg-white px-5 py-3 text-sm font-semibold text-[#5E4840] hover:border-[#DC926E] hover:text-[#A26548]"
              >
                <HiArrowLeft /> View more products
              </Link>
            </div>
          </div>
        </div>
      </article>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          {detailSections.map((section) => (
            <section key={section.title} className="rounded-[1.75rem] border border-[#EDE3DC] bg-white p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-[#46352F]">{section.title}</h2>
              <div className="mt-5 space-y-4">
                {section.items.map((item) => (
                  <div key={item.label} className="border-b border-[#F2ECE8] pb-3 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A38F83]">{item.label}</p>
                      {item.source && (
                        <span className="rounded-full bg-[#F8F1EC] px-2 py-0.5 text-[9px] font-medium text-[#8C6B57]">
                          {item.source}
                        </span>
                      )}
                    </div>
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm font-medium text-[#B76F4D] underline decoration-[#E0BFAB] underline-offset-4">
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#584E49]">{String(item.value || "Follow the manufacturer's instructions on the product packaging.")}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-[1.75rem] border border-[#EDE3DC] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <HiOutlineBeaker className="text-xl text-[#B77A5A]" />
              <h2 className="text-xl font-semibold text-[#46352F]">Ingredients</h2>
            </div>
            <p className="mt-2 text-xs text-[#8C7A6F]">
              {product.contentSource?.ingredients === "manufacturer"
                ? "Ingredient information from the manufacturer listing. Concentrations are shown only when provided."
                : "Ingredient information from the product record. Concentrations are shown only when provided."}
            </p>
            {ingredientList.length > 0 ? (
              <div className="mt-5 space-y-3">
                {ingredientList.map((ingredient, idx) => (
                  <div
                    key={`${typeof ingredient === "string" ? ingredient : ingredient.name}-${idx}`}
                    className="rounded-2xl bg-[#FAF6F3] p-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm font-medium text-[#46352F]">
                        {typeof ingredient === "string" ? ingredient : ingredient.name}
                      </span>
                      <span className="text-right text-xs text-[#7A685F]">
                        {typeof ingredient === "string" || !ingredient.concentration
                          ? "Concentration not provided"
                          : ingredient.concentration}
                      </span>
                    </div>
                    {product.aiGeneratedContent?.ingredientFunctions?.find(
                      (entry) =>
                        entry.name.toLowerCase() ===
                        (typeof ingredient === "string" ? ingredient : ingredient.name).toLowerCase()
                    )?.function && (
                      <div className="mt-2 border-t border-[#EFE4DC] pt-2">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[#9F816E]">
                          AI-generated ingredient guidance
                        </span>
                        <p className="mt-1 text-xs leading-5 text-[#7A685F]">
                          {product.aiGeneratedContent.ingredientFunctions.find(
                            (entry) =>
                              entry.name.toLowerCase() ===
                              (typeof ingredient === "string" ? ingredient : ingredient.name).toLowerCase()
                          ).function}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#584E49]">No ingredient list was supplied for this product. Refer to the packaging for the complete ingredient list.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[1.75rem] border border-[#EDE3DC] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <HiOutlineInformationCircle className="text-xl text-[#B77A5A]" />
              <h2 className="text-xl font-semibold text-[#46352F]">Important notes</h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#584E49]">
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-[#D89A79]" /> Product details are kept internal to DermaVision and should be read as general skincare information, not a diagnosis.</li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-[#D89A79]" /> If you have sensitive skin, patch testing is a good practice before using a new active ingredient.</li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-[#D89A79]" /> Follow the manufacturer guidance for frequency and sun protection where relevant.</li>
            </ul>
          </section>

          <section className="rounded-[1.75rem] border border-[#EDE3DC] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <HiOutlineShieldCheck className="text-xl text-[#B77A5A]" />
              <h2 className="text-xl font-semibold text-[#46352F]">You May Also Like</h2>
            </div>
            <div className="mt-5 space-y-3">
              {relatedProducts.length > 0 ? (
                relatedProducts.map((item) => (
                  <Link
                    key={item._id || item.id || item.slug}
                    to={`/products/${encodeURIComponent(item._id || item.id || item.slug)}`}
                    className="flex gap-3 rounded-2xl border border-[#F0E6E0] bg-[#FAF6F3] p-3 transition hover:border-[#E3B69C] hover:bg-[#FFF9F6]"
                  >
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#F3E5DC] text-[#BA8061]">
                      <ProductImage
                        imageUrl={item.imageUrl}
                        name={item.name}
                        brand={item.brand}
                        className="h-20 w-20 rounded-xl object-contain p-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9F816E]">{item.brand}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-[#46352F]">{item.name}</p>
                      <p className="mt-1 text-xs text-[#756760]">{formatPrice(item.price, item.currency)}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-[#584E49]">
                  {relatedError || "No related products available right now."}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ProductDetails;
