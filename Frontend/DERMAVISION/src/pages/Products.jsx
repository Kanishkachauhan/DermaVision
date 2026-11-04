import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineAdjustments,
  HiOutlineBeaker,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
  HiStar,
} from "react-icons/hi";
import { apiRequest } from "../utils/api";

const PAGE_SIZE = 12;
const CATEGORIES = [
  "All",
  "Cleanser",
  "Serum",
  "Moisturizer",
  "Sunscreen",
  "Toner",
  "Exfoliator",
  "FaceMask",
  "FaceWash",
];
const SKIN_TYPES = ["All skin types", "Oily", "Dry", "Combination", "Normal"];

const DEMO_PRODUCTS = [
  {
    _id: "demo-spf-50",
    name: "SPF 50 Sunscreen",
    brand: "Minimalist",
    category: "Sunscreen",
    price: 224,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/SPF50New.jpg?v=1756795782",
    buyLink: "https://beminimalist.co/products/multi-vitamin-spf-50",
    description: "Broad-spectrum SPF 50 sunscreen with PA++++.",
    ingredients: ["Vitamins B, E & F"],
    targetConditions: ["Sun protection"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-light-fluid-spf",
    name: "Light Fluid SPF 50 Sunscreen",
    brand: "Minimalist",
    category: "Sunscreen",
    price: 314,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/Artboard_1_1.jpg?v=1783323907",
    buyLink: "https://beminimalist.co/products/light-fluid-spf-50-sunscreen",
    description: "Light-fluid SPF 50 sunscreen for daily sun protection.",
    ingredients: ["UV filters"],
    targetConditions: ["Sun protection"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-spf-60",
    name: "SPF 60 Sunscreen",
    brand: "Minimalist",
    category: "Sunscreen",
    price: 539,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/products/SPF601200-2-min.png?v=1646571969",
    buyLink: "https://beminimalist.co/products/spf-60-silymarin",
    description: "High-protection sunscreen for daily use.",
    ingredients: ["Silymarin"],
    targetConditions: ["Sun protection"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-alpha-arbutin",
    name: "Alpha Arbutin 2% Face Serum",
    brand: "Minimalist",
    category: "Serum",
    price: 237,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/AlphaArNew.png?v=1721397838",
    buyLink: "https://beminimalist.co/products/alpha-arbutin-2",
    description: "A targeted serum featuring 2% alpha arbutin.",
    ingredients: ["Alpha arbutin"],
    targetConditions: ["Dark spots", "Uneven tone"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-niacinamide",
    name: "Niacinamide 10% Face Serum",
    brand: "Minimalist",
    category: "Serum",
    price: 237,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/Nia10New.png?v=1721398127",
    buyLink: "https://beminimalist.co/products/niacinamide-10-with-matmarine",
    description: "A 10% niacinamide serum for an everyday skincare routine.",
    ingredients: ["Niacinamide"],
    targetConditions: ["Oil balance", "Uneven tone"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-multi-peptide",
    name: "Multi-Peptides 10% Face Serum",
    brand: "Minimalist",
    category: "Serum",
    price: 629,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/MultiNew.png?v=1721398128",
    buyLink: "https://beminimalist.co/products/multi-peptide-serum-7-matrixyl-3000-3-bio-placenta",
    description: "A peptide serum for a simple evening skincare routine.",
    ingredients: ["Multi-peptides"],
    targetConditions: ["Fine lines", "Hydration"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-vitamin-c",
    name: "Vitamin C 10% Face Serum",
    brand: "Minimalist",
    category: "Serum",
    price: 285,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/products/VitaminC10_1200-1-min.png?v=1646543848",
    buyLink: "https://beminimalist.co/products/vitamin-c-ethyl-ascorbic-acid-10-acetyl-glucosamine-1",
    description: "A 10% vitamin C serum for daily skincare.",
    ingredients: ["Vitamin C"],
    targetConditions: ["Dullness", "Uneven tone"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-oat-cleanser",
    name: "B12 + Oat Extract 6.5% Gentle Cleanser",
    brand: "Minimalist",
    category: "Cleanser",
    price: 269,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/B12_Oat_Extract_6.5.jpg?v=1783083799",
    buyLink: "https://beminimalist.co/products/oat-extract-06-gentle-cleanser",
    description: "A gentle daily cleanser with oat extract and vitamin B12.",
    ingredients: ["Oat extract", "Vitamin B12"],
    targetConditions: ["Sensitive skin"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-salicylic-cleanser",
    name: "Salicylic Acid + LHA 2% Cleanser",
    brand: "Minimalist",
    category: "Cleanser",
    price: 269,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/SalicylicCleanserNew.jpg?v=1756796206",
    buyLink: "https://beminimalist.co/products/salicylic-lha-2-cleanser",
    description: "A daily cleanser featuring salicylic acid and LHA.",
    ingredients: ["Salicylic acid", "LHA"],
    targetConditions: ["Oil balance"],
    skinTypes: ["Oily", "Combination"],
  },
  {
    _id: "demo-aquaporin-cleanser",
    name: "Aquaporin Booster 5% Cleanser",
    brand: "Minimalist",
    category: "Cleanser",
    price: 269,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/AquaporinNew.png?v=1721398128",
    buyLink: "https://beminimalist.co/products/aquaporin-booster-05-cleanser",
    description: "A hydrating daily cleanser with aquaporin boosters.",
    ingredients: ["Aquaporin boosters"],
    targetConditions: ["Dryness", "Hydration"],
    skinTypes: ["Dry", "Normal"],
  },
  {
    _id: "demo-ceramides-moisturizer",
    name: "Ceramides 0.3% + Madecassoside Moisturizer",
    brand: "Minimalist",
    category: "Moisturizer",
    price: 539,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/Ceramide_Madecassoside.png?v=1721398128",
    buyLink: "https://beminimalist.co/products/ceramides-0-3-madecassoside",
    description: "A moisturizer featuring ceramides and madecassoside.",
    ingredients: ["Ceramides", "Madecassoside"],
    targetConditions: ["Barrier care", "Hydration"],
    skinTypes: ["Oily", "Dry", "Combination", "Normal"],
  },
  {
    _id: "demo-vitamin-b5-moisturizer",
    name: "Vitamin B5 10% Moisturizer",
    brand: "Minimalist",
    category: "Moisturizer",
    price: 314,
    rating: 0,
    imageUrl: "https://cdn.shopify.com/s/files/1/0410/9608/5665/products/B5Moisturizer1200-2-min.png?v=1756800645",
    buyLink: "https://beminimalist.co/products/vitamin-b5-10-moisturizer",
    description: "An oil-free moisturizer with 10% vitamin B5.",
    ingredients: ["Vitamin B5", "Hyaluronic acid"],
    targetConditions: ["Oily and dehydrated skin"],
    skinTypes: ["Oily", "Combination"],
  },
];

const formatCategory = (category = "") =>
  category.replace(/([a-z])([A-Z])/g, "$1 $2");

const getDemoProducts = (category, skinType) =>
  DEMO_PRODUCTS.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const matchesSkinType =
      skinType === "All skin types" || product.skinTypes.includes(skinType);
    return matchesCategory && matchesSkinType;
  });

const getProductKey = (product) =>
  `${product.brand || ""}:${product.name || ""}`.trim().toLowerCase();

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

const Products = () => {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All");
  const [skinType, setSkinType] = useState("All skin types");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalogNotice, setCatalogNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (category !== "All") params.set("category", category);
    if (skinType !== "All skin types") params.set("skinType", skinType);

    setLoading(true);
    setError("");
    setCatalogNotice("");

    apiRequest(`/products?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        const liveProducts = data.products || [];
        const demoProducts = getDemoProducts(category, skinType);
        const liveKeys = new Set(liveProducts.map(getProductKey));
        const uniqueDemoProducts = demoProducts.filter(
          (product) => !liveKeys.has(getProductKey(product))
        );

        setProducts((current) => {
          const existingProducts = page === 1 ? liveProducts : current;
          const existingKeys = new Set(existingProducts.map(getProductKey));
          const additionalLiveProducts =
            page === 1
              ? []
              : liveProducts.filter((product) => !existingKeys.has(getProductKey(product)));
          const baseProducts = [...existingProducts, ...additionalLiveProducts];
          const baseKeys = new Set(baseProducts.map(getProductKey));
          return [
            ...baseProducts,
            ...demoProducts.filter((product) => !baseKeys.has(getProductKey(product))),
          ];
        });
        if (page === 1) {
          setTotal((data.total || 0) + uniqueDemoProducts.length);
          setCatalogNotice(
            uniqueDemoProducts.length
              ? "Sample OTC products · indicative prices · check the brand site for current details."
              : ""
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (page === 1) {
            const demoProducts = getDemoProducts(category, skinType);
            setProducts(demoProducts);
            setTotal(demoProducts.length);
            setError("");
            setCatalogNotice(
              `Live products are unavailable (${err.message || "connection error"}). Showing sample OTC products instead.`
            );
          } else {
            setCatalogNotice(
              `More live products are unavailable (${err.message || "connection error"}). Showing the products already loaded.`
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, skinType, page, reloadKey]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (!normalizedSearch) return true;
      const searchable = [
        product.name,
        product.brand,
        product.category,
        product.description,
        ...(product.ingredients || []),
        ...(product.targetConditions || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedSearch);
    });

    if (sort === "price-low") return filtered.sort((a, b) => a.price - b.price);
    if (sort === "price-high") return filtered.sort((a, b) => b.price - a.price);
    if (sort === "rating") return filtered.sort((a, b) => b.rating - a.rating);
    return filtered;
  }, [products, search, sort]);

  const updateCategory = (value) => {
    setPage(1);
    setCategory(value);
  };

  const updateSkinType = (event) => {
    setPage(1);
    setSkinType(event.target.value);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <section className="relative isolate overflow-hidden border-b border-[#EDE3DC] bg-[#F6E7DE]">
        <div className="absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-[#EAC0A9]/50 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 -z-10 h-80 w-80 rounded-full bg-white/70 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.72fr] lg:items-center lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#E6C5B1] bg-white/70 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#94654E]">
              <HiOutlineSparkles className="text-base" />
              YOUR ROUTINE, THOUGHTFULLY CURATED
            </div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-[#46352F] sm:text-5xl lg:text-6xl">
              Find your skin&apos;s
              <span className="block font-normal italic text-[#C77E5E]">daily essentials.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#77675E] sm:text-base">
              Explore skincare picked for your routine. Browse by product type
              and skin type to find what fits you.
            </p>
            <a
              href="#product-catalog"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#DC926E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#C87E5B] hover:shadow-md"
            >
              Explore products <HiArrowRight className="text-base" />
            </a>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-[#78675D]">
              <span className="inline-flex items-center gap-2">
                <HiOutlineShieldCheck className="text-lg text-[#B77A5A]" />
                Clear ingredient details
              </span>
              <span className="inline-flex items-center gap-2">
                <HiOutlineBeaker className="text-lg text-[#B77A5A]" />
                Browse by skin type
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 rounded-[2rem] border border-white/70" />
            <div className="relative overflow-hidden rounded-[1.7rem] border border-white/80 bg-gradient-to-br from-[#FFFDFB] via-[#F7E9E0] to-[#E8C4AF] p-7 shadow-[0_24px_70px_-35px_rgba(91,61,44,0.45)] sm:p-9">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A16B50]">
                    A little skin ritual
                  </p>
                  <p className="mt-2 max-w-[12rem] text-2xl font-medium leading-tight text-[#46352F]">
                    Small steps.
                    <br />
                    Softer mornings.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[#C77E5E] shadow-sm">
                  <HiOutlineSparkles className="text-2xl" />
                </div>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Cleanse",
                    color: "from-[#F4DDCF] to-[#E8BFA9]",
                    image: DEMO_PRODUCTS.find((product) => product._id === "demo-oat-cleanser"),
                  },
                  {
                    label: "Clear",
                    color: "from-[#F7E8D5] to-[#DDBA91]",
                    image: DEMO_PRODUCTS.find((product) => product._id === "demo-alpha-arbutin"),
                  },
                  {
                    label: "Protect",
                    color: "from-[#E7E9D7] to-[#C4C9A3]",
                    image: DEMO_PRODUCTS.find((product) => product._id === "demo-spf-50"),
                  },
                ].map((step, index) => (
                  <div key={step.label}>
                    <div
                      className={`relative flex aspect-[0.8] items-end overflow-hidden rounded-2xl bg-gradient-to-br ${step.color}`}
                    >
                      <img
                        src={step.image.imageUrl}
                        alt={`${step.label} skincare product`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-[#46352F]/20 via-transparent to-white/10" />
                      <span className="absolute bottom-2.5 left-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-semibold text-[#725747] shadow-sm">
                        0{index + 1}
                      </span>
                    </div>
                    <p className="mt-2 text-center text-xs font-medium text-[#66564D]">
                      {step.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F6E7DE] text-[#B77A5A]">
                  <HiOutlineShieldCheck className="text-lg" />
                </span>
                <p className="text-xs leading-5 text-[#76645A]">
                  Keep it simple. Give your skin time to find its rhythm.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product-catalog" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C77E5E]">
              The edit
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#46352F] sm:text-4xl">
              Skincare essentials
            </h2>
            <p className="mt-2 text-sm text-[#85766D]">
              {loading && products.length === 0
                ? "Finding products for you…"
                : `${total} ${total === 1 ? "product" : "products"} to explore`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block sm:w-64">
              <HiOutlineSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#A5968D]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products or ingredients"
                aria-label="Search products or ingredients"
                className="w-full rounded-xl border border-[#E8DFD8] bg-white py-3 pl-10 pr-4 text-sm text-[#46352F] outline-none transition placeholder:text-[#A99B92] focus:border-[#D89A79] focus:ring-2 focus:ring-[#DC926E]/15"
              />
            </label>
            <label className="relative">
              <HiOutlineAdjustments className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#A5968D]" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort products"
                className="w-full appearance-none rounded-xl border border-[#E8DFD8] bg-white py-3 pl-10 pr-9 text-sm text-[#64564E] outline-none focus:border-[#D89A79] sm:w-auto"
              >
                <option value="recommended">Recommended</option>
                <option value="rating">Top rated</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#A5968D]">
                ▼
              </span>
            </label>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-b border-[#E9E0DA] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateCategory(item)}
                aria-pressed={category === item}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition ${
                  category === item
                    ? "bg-[#46352F] text-white shadow-sm"
                    : "border border-[#E8DFD8] bg-white text-[#77675E] hover:border-[#D9AE98] hover:text-[#A26548]"
                }`}
              >
                {formatCategory(item)}
              </button>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#78675D]">
            Skin type
            <select
              value={skinType}
              onChange={updateSkinType}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-xs text-[#64564E] outline-none focus:border-[#D89A79]"
            >
              {SKIN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        {catalogNotice && (
          <div className="mt-6 rounded-xl border border-[#E9D6C9] bg-[#FFF7F1] px-4 py-3 text-xs leading-5 text-[#795D4C]">
            {catalogNotice}
          </div>
        )}

        {error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <HiOutlineExclamationCircle className="mx-auto text-3xl text-red-500" />
            <h3 className="mt-3 font-semibold text-[#46352F]">Products didn&apos;t load</h3>
            <p className="mt-1 text-sm text-[#78675D]">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#76533F] shadow-sm ring-1 ring-red-200 transition hover:bg-red-50"
            >
              <HiOutlineRefresh /> Try again
            </button>
          </div>
        ) : loading && products.length === 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-[#EEE5DF] bg-white">
                <div className="aspect-[1.08] animate-pulse bg-[#F1E8E2]" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[#F1E8E2]" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-[#F1E8E2]" />
                  <div className="h-3 w-full animate-pulse rounded bg-[#F1E8E2]" />
                  <div className="h-8 w-1/2 animate-pulse rounded bg-[#F1E8E2]" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleProducts.length > 0 ? (
          <>
            <div className={`mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
              {visibleProducts.map((product) => (
                <article
                  key={product._id}
                  className="group overflow-hidden rounded-2xl border border-[#EEE5DF] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#E0C9BB] hover:shadow-[0_18px_45px_-30px_rgba(70,53,47,0.4)]"
                >
                  <div className="relative aspect-[1.08] overflow-hidden bg-gradient-to-br from-[#F8EEE8] via-[#F5E5DA] to-[#E8D1C2]">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center">
                        <span className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/80 bg-white/60 text-[#BA8061] shadow-sm">
                          <HiOutlineBeaker className="text-4xl" />
                        </span>
                        <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9B735E]">
                          {formatCategory(product.category)}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#785744] backdrop-blur">
                      {formatCategory(product.category)}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A1816D]">
                      {product.brand}
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 min-h-11 text-base font-semibold leading-5 text-[#46352F]">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-5 text-[#887A71]">
                        {product.description}
                      </p>
                    )}
                    {product.ingredients?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {product.ingredients.slice(0, 2).map((ingredient) => (
                          <span
                            key={ingredient}
                            className="rounded-full bg-[#F8F1EC] px-2.5 py-1 text-[10px] font-medium text-[#8C6B57]"
                          >
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-[#F0E9E4] pt-3">
                      <span className="text-lg font-semibold text-[#46352F]">
                        {catalogNotice ? `From ${formatPrice(product.price)}` : formatPrice(product.price)}
                      </span>
                      {product.rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#79685E]">
                          <HiStar className="text-base text-[#D99A45]" />
                          {Number(product.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                    {product.buyLink ? (
                      <a
                        href={product.buyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E8DFD8] bg-white py-2.5 text-xs font-semibold text-[#604C40] transition hover:border-[#DC926E] hover:bg-[#FFF8F4] hover:text-[#A26548]"
                      >
                        View at official store <HiArrowRight className="text-sm" />
                      </a>
                    ) : (
                      <span className="mt-3 block w-full rounded-xl bg-[#F8F5F2] py-2.5 text-center text-xs font-medium text-[#A0958D]">
                        Product details coming soon
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {products.length < total && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#DCC8BB] bg-white px-6 py-3 text-sm font-semibold text-[#6D5141] transition hover:border-[#C98D6B] hover:bg-[#FFF8F4] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Loading…" : "Load more products"}
                  {!loading && <HiArrowRight />}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-[#DCCBC0] bg-white/70 px-6 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7ECE5] text-[#B77A5A]">
              <HiOutlineSearch className="text-2xl" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-[#46352F]">
              {search ? "No matches just yet" : "Your shelf is getting ready"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#85766D]">
              {search
                ? "Try another product, brand, or ingredient—or clear your search to see all available products."
                : "There are no products in this selection right now. Try another category or skin type."}
            </p>
            {(search || category !== "All" || skinType !== "All skin types") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                  setCategory("All");
                  setSkinType("All skin types");
                }}
                className="mt-5 text-sm font-semibold text-[#B46F4F] underline decoration-[#E3BBA5] underline-offset-4 hover:text-[#8F5339]"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 sm:pb-20 lg:px-12">
        <div className="flex flex-col gap-5 rounded-3xl bg-[#46352F] px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-9 sm:py-9">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E6B398]">
              Not sure where to start?
            </p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
              Get to know your skin first.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Explore your skin analysis and build a routine that feels right for you.
            </p>
          </div>
          <Link
            to="/analysis"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#E6A17F] px-5 py-3 text-sm font-semibold text-[#3D2C25] transition hover:bg-[#F0B08E]"
          >
            Explore skin analysis <HiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Products;
