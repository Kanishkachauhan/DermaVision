import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineBeaker,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineSparkles,
} from "react-icons/hi";
import ProductImage from "../components/ProductImage";
import { apiRequest } from "../utils/api";

const PAGE_SIZE = 12;
const CATEGORIES = [
  "All",
  "Cleanser",
  "Face Wash",
  "Face Mask",
  "Moisturizer",
  "Serum",
  "Sunscreen",
  "Toner",
  "Exfoliator",
  "Treatment",
];
const BRANDS = ["All", "The Derma Co.", "Deconstruct", "Cetaphil", "Dot & Key"];
const SKIN_TYPES = ["All skin types", "Oily", "Dry", "Combination", "Normal", "Sensitive"];
const CONCERNS = [
  "All concerns",
  "Acne-prone skin",
  "Dark spots",
  "Dryness",
  "Oily skin",
  "Pigmentation",
  "Sensitive skin",
  "Sun protection",
];

const ingredientsToNames = (ingredients = []) =>
  ingredients
    .map((ingredient) =>
      typeof ingredient === "string" ? ingredient : ingredient?.name || ""
    )
    .filter(Boolean);

const getProductPath = (product) => {
  const identifier = product._id || product.id || product.slug;
  return identifier ? `/products/${encodeURIComponent(identifier)}` : "/products";
};

const formatPrice = (price, currency = "INR") => {
  if (price == null || price === "") return "Information not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(Number(price));
};

const formatCategory = (category = "") =>
  category.replace(/([a-z])([A-Z])/g, "$1 $2");

const Products = () => {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All");
  const [brand, setBrand] = useState("All");
  const [concern, setConcern] = useState("All concerns");
  const [skinType, setSkinType] = useState("All skin types");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (category !== "All") params.set("category", category);
    if (brand !== "All") params.set("brand", brand);
    if (concern !== "All concerns") params.set("concern", concern);
    if (skinType !== "All skin types") params.set("skinType", skinType);
    if (debouncedSearch) params.set("search", debouncedSearch);

    setLoading(true);
    setError("");
    if (page === 1) setProducts([]);

    apiRequest(`/products?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setProducts((current) =>
          page === 1 ? data.products || [] : [...current, ...(data.products || [])]
        );
        setTotal(Number(data.total) || 0);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || "Unable to load products.");
          if (page === 1) {
            setProducts([]);
            setTotal(0);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, brand, concern, skinType, debouncedSearch, page, reloadKey]);

  const visibleProducts = useMemo(() => {
    const ordered = [...products];
    if (sort === "price-low") return ordered.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === "price-high") return ordered.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    if (sort === "rating") return ordered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return ordered;
  }, [products, sort]);

  const updateSearch = (event) => {
    setPage(1);
    setSearch(event.target.value);
  };

  const updateFilter = (setter) => (event) => {
    setPage(1);
    setter(event.target.value);
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategory("All");
    setBrand("All");
    setConcern("All concerns");
    setSkinType("All skin types");
    setPage(1);
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
              Browse products stored in DermaVision, with manufacturer sources
              available on each product page. Filter by brand, category, and concern.
            </p>
            <a
              href="#product-catalog"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#DC926E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#C87E5B] hover:shadow-md"
            >
              Explore products <HiArrowRight className="text-base" />
            </a>
          </div>

          <div className="relative mx-auto min-h-[350px] w-full max-w-xl sm:min-h-[430px]">
            <div className="absolute inset-x-8 inset-y-5 rounded-[2.5rem] bg-gradient-to-br from-[#F7DCCB] via-[#F9EEE6] to-[#E8B99C] shadow-[0_30px_80px_-45px_rgba(91,61,44,0.55)] sm:inset-x-12" />
            <div className="absolute -right-1 top-5 h-24 w-24 rounded-full border border-white/60 sm:right-1 sm:top-8 sm:h-32 sm:w-32" />
            <div className="absolute bottom-9 left-1 h-20 w-20 rounded-full bg-white/30 blur-xl sm:bottom-12 sm:left-3 sm:h-28 sm:w-28" />

            {products.slice(0, 3).map((product, index) => {
              const placements = [
                "left-[18%] top-[7%] z-10 h-[78%] w-[64%]",
                "right-[1%] top-[13%] z-20 h-[37%] w-[36%]",
                "bottom-[5%] left-[1%] z-20 h-[36%] w-[36%]",
              ];
              return (
                <Link
                  key={product._id || product.id || product.slug}
                  to={getProductPath(product)}
                  aria-label={`View ${product.name} details`}
                  className={`group absolute overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/90 shadow-[0_18px_45px_-24px_rgba(70,53,47,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_-24px_rgba(70,53,47,0.5)] ${placements[index]}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFFDFB] to-[#F4E5DA]" />
                  <ProductImage
                    imageUrl={product.imageUrl}
                    name={product.name}
                    brand={product.brand}
                    loading="eager"
                    className="absolute inset-0 h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105 sm:p-6"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#49362E]/85 via-[#49362E]/35 to-transparent px-3 pb-3 pt-10 text-white sm:px-4 sm:pb-4">
                    <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75 sm:text-[10px]">
                      {product.brand}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug sm:text-sm">
                      {product.name}
                    </p>
                  </div>
                </Link>
              );
            })}

            {products.length === 0 && (
              <div className="absolute left-[18%] top-[7%] z-10 h-[78%] w-[64%] overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/80 shadow-[0_18px_45px_-24px_rgba(70,53,47,0.45)]">
                <ProductImage
                  name="Skincare essential"
                  className="absolute inset-0 h-full w-full object-contain p-8 sm:p-12"
                  loading="eager"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#49362E]/80 to-transparent px-4 pb-4 pt-12 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">A little skin ritual</p>
                  <p className="mt-1 text-sm font-semibold">Small steps. Thoughtful choices.</p>
                </div>
              </div>
            )}

            <div className="absolute bottom-2 right-2 z-30 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[10px] font-semibold text-[#76533F] shadow-lg backdrop-blur sm:bottom-4 sm:right-4 sm:text-xs">
              <HiOutlineBeaker className="text-base text-[#C77E5E]" />
              Thoughtful skincare, all in one place
            </div>
          </div>
        </div>
      </section>

      <section id="product-catalog" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C77E5E]">The edit</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#46352F] sm:text-4xl">
              Skincare essentials
            </h2>
            <p className="mt-2 text-sm text-[#85766D]">
              {loading && products.length === 0
                ? "Loading products…"
                : `${total} ${total === 1 ? "product" : "products"} to explore`}
            </p>
          </div>
          <label className="relative block sm:w-72">
            <HiOutlineSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#A5968D]" />
            <input
              type="search"
              value={search}
              onChange={updateSearch}
              placeholder="Search products or brands"
              aria-label="Search products or brands"
              className="w-full rounded-xl border border-[#E8DFD8] bg-white py-3 pl-10 pr-4 text-sm text-[#46352F] outline-none transition placeholder:text-[#A99B92] focus:border-[#D89A79] focus:ring-2 focus:ring-[#DC926E]/15"
            />
          </label>
        </div>

        <div className="mt-8 grid gap-3 border-b border-[#E9E0DA] pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-2 text-xs font-medium text-[#78675D]">
            Brand
            <select
              value={brand}
              onChange={updateFilter(setBrand)}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2.5 text-sm text-[#64564E] outline-none focus:border-[#D89A79]"
            >
              {BRANDS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-[#78675D]">
            Category
            <select
              value={category}
              onChange={updateFilter(setCategory)}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2.5 text-sm text-[#64564E] outline-none focus:border-[#D89A79]"
            >
              {CATEGORIES.map((item) => <option key={item} value={item}>{formatCategory(item)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-[#78675D]">
            Skin concern
            <select
              value={concern}
              onChange={updateFilter(setConcern)}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2.5 text-sm text-[#64564E] outline-none focus:border-[#D89A79]"
            >
              {CONCERNS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-[#78675D]">
            Skin type
            <select
              value={skinType}
              onChange={updateFilter(setSkinType)}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2.5 text-sm text-[#64564E] outline-none focus:border-[#D89A79]"
            >
              {SKIN_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-center justify-end gap-2 text-xs font-medium text-[#78675D]">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2 text-xs text-[#64564E] outline-none focus:border-[#D89A79]"
          >
            <option value="recommended">Recommended</option>
            <option value="rating">Top rated</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>

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
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading products">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-[#EEE5DF] bg-white">
                <div className="aspect-[1.08] animate-pulse bg-[#F1E8E2]" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[#F1E8E2]" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-[#F1E8E2]" />
                  <div className="h-3 w-full animate-pulse rounded bg-[#F1E8E2]" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className={`mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
              {visibleProducts.map((product) => (
                <Link
                  key={product._id || product.id || product.slug}
                  to={getProductPath(product)}
                  className="group overflow-hidden rounded-2xl border border-[#EEE5DF] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#E0C9BB] hover:shadow-[0_18px_45px_-30px_rgba(70,53,47,0.4)] focus:outline-none focus:ring-2 focus:ring-[#DC926E]/30"
                >
                  <div className="relative flex aspect-[1.08] items-center justify-center overflow-hidden bg-gradient-to-br from-[#F8EEE8] via-[#F5E5DA] to-[#E8D1C2]">
                    <ProductImage
                      imageUrl={product.imageUrl}
                      name={product.name}
                      brand={product.brand}
                      className="absolute inset-0 h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
                    />
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
                    {ingredientsToNames(product.ingredients).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {ingredientsToNames(product.ingredients).slice(0, 2).map((ingredient) => (
                          <span key={ingredient} className="rounded-full bg-[#F8F1EC] px-2.5 py-1 text-[10px] font-medium text-[#8C6B57]">
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-[#F0E9E4] pt-3">
                      <span className="text-sm font-semibold text-[#46352F]">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#A26548]">
                        View details <HiArrowRight className="text-sm" />
                      </span>
                    </div>
                  </div>
                </Link>
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
            <h3 className="mt-4 text-lg font-semibold text-[#46352F]">No products found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#85766D]">
              Try a different search or clear your filters.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 text-sm font-semibold text-[#B46F4F] underline decoration-[#E3BBA5] underline-offset-4 hover:text-[#8F5339]"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Products;
