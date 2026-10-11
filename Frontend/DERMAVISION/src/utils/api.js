// src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Shared fetch wrapper for backend API requests
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('dermavision_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: 'include',
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg =
        data.message ||
        (Array.isArray(data.errors) && data.errors[0]?.msg) ||
        `Request failed with status ${response.status}`;

      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      const connErr = new Error(
        'Cannot connect to backend server. Please ensure the backend is running on port 5001.'
      );
      connErr.status = 503;
      throw connErr;
    }
    throw err;
  }
}

/**
 * Send dark circle analysis to backend → forwarded to Python AI service
 */
export async function analyzeDarkCirclesApi(payload) {
  return apiRequest('/analysis/dark-circles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Send acne & pore analysis to backend → forwarded to EfficientNet-B0/B3 AI service
 */
export async function analyzeAcneApi(payload) {
  return apiRequest('/analysis/acne', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Send redness analysis to backend AI service
 */
export async function analyzeRednessApi(payload) {
  return apiRequest('/analysis/redness', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Overpass / OpenStreetMap Free API Integration ──────────────────────────

const OVERPASS_MIRRORS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Haversine distance formula between two lat/lng pairs in kilometers
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
};

/**
 * Build dynamic Overpass QL query covering dermatology, doctors, clinics, hospitals
 */
export const buildOverpassQuery = (lat, lng, radius) => {
  return `[out:json][timeout:25];
(
  nwr["healthcare"="dermatologist"](around:${radius},${lat},${lng});
  nwr["healthcare:speciality"="dermatology"](around:${radius},${lat},${lng});
  nwr["speciality"="dermatology"](around:${radius},${lat},${lng});
  nwr["healthcare"="doctor"](around:${radius},${lat},${lng});
  nwr["amenity"="doctors"](around:${radius},${lat},${lng});
  nwr["amenity"="clinic"](around:${radius},${lat},${lng});
  nwr["healthcare"="clinic"](around:${radius},${lat},${lng});
  nwr["healthcare"="hospital"](around:${radius},${lat},${lng});
  nwr["amenity"="hospital"](around:${radius},${lat},${lng});
);
out center tags;`;
};

/**
 * Inspects tags to categorize accurately
 */
const determineCategory = (tags, name) => {
  const spec = (tags['healthcare:speciality'] || tags['speciality'] || '').toLowerCase();
  const hc = (tags['healthcare'] || '').toLowerCase();
  const amen = (tags['amenity'] || '').toLowerCase();
  const lowerName = (name || '').toLowerCase();

  const isDerm =
    spec.includes('derma') ||
    hc.includes('dermatolog') ||
    lowerName.includes('skin') ||
    lowerName.includes('derma') ||
    lowerName.includes('cutan') ||
    lowerName.includes('tricholog') ||
    lowerName.includes('aesthetic') ||
    lowerName.includes('laser');

  if (isDerm) {
    return { category: 'Dermatologist', isDermatologyConfirmed: true };
  }

  if (amen === 'clinic' || hc === 'clinic') {
    return { category: 'Clinic', isDermatologyConfirmed: false };
  }
  if (amen === 'hospital' || hc === 'hospital') {
    return { category: 'Hospital', isDermatologyConfirmed: false };
  }
  if (amen === 'doctors' || hc === 'doctor') {
    return { category: 'Doctor', isDermatologyConfirmed: false };
  }

  return { category: 'Healthcare', isDermatologyConfirmed: false };
};

/**
 * Normalises an OpenStreetMap element into a doctor/facility card object
 * strictly using authentic data from OSM.
 */
export const normaliseOsmElement = (el, userLat, userLng) => {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;

  const rawName = tags.name || tags['name:en'] || tags.operator || tags.brand || null;
  const name = rawName || 'Unnamed healthcare facility';

  const { category, isDermatologyConfirmed } = determineCategory(tags, name);

  // Free OpenStreetMap directions URL
  const directionsUrl =
    lat !== null && lng !== null
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${userLat}%2C${userLng}%3B${lat}%2C${lng}`
      : `https://www.openstreetmap.org/search?query=${encodeURIComponent(name)}`;

  // Real address construction from available OSM tags
  const streetPart = tags['addr:housenumber'] && tags['addr:street']
    ? `${tags['addr:housenumber']} ${tags['addr:street']}`
    : tags['addr:street'];
  const locality = tags['addr:city'] || tags['addr:suburb'] || tags['addr:district'] || tags['addr:town'];
  const addressParts = [streetPart, locality, tags['addr:state'], tags['addr:postcode']].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : (tags['addr:full'] || null);

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    category,
    isDermatologyConfirmed,
    address,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    openingHours: tags.opening_hours || null,
    openNow: null,
    latitude: lat,
    longitude: lng,
    distance: lat !== null && lng !== null ? calculateDistance(userLat, userLng, lat, lng) : null,
    rating: null, // Strictly no fake ratings
    directionsUrl,
    osmType: tags.amenity || tags.healthcare || 'medical',
    osmSpeciality: tags['healthcare:speciality'] || tags['speciality'] || null,
  };
};

/**
 * Search city, neighborhood, or postal code coordinates using OpenStreetMap Nominatim
 */
export async function searchCityNominatim(query) {
  if (!query || !query.trim()) throw new Error('Please enter a city or location to search.');

  const trimmed = query.trim();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    trimmed
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Location "${trimmed}" not found. Try entering a city or landmark name.`);
    }

    const item = data[0];
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Invalid coordinates returned for this location.');
    }

    const shortName = item.display_name.split(',').slice(0, 2).join(',').trim();

    return {
      lat,
      lng,
      displayName: shortName || item.display_name,
      fullName: item.display_name,
    };
  } catch (err) {
    throw new Error(err.message || 'Could not locate address on OpenStreetMap.');
  }
}

/**
 * Fetch nearby healthcare and dermatologist locations using OpenStreetMap Overpass API.
 * 100% free and open source.
 * Attempts client-side Overpass mirrors first; if blocked by network/browser extensions,
 * seamlessly falls back to the backend proxy endpoint.
 */
export async function fetchOverpassDoctors({ lat, lng, radius = 5000 }) {
  const validLat = Number(parseFloat(lat));
  const validLng = Number(parseFloat(lng));
  const validRadius = Math.min(Math.max(parseInt(radius, 10) || 5000, 1000), 50000);

  if (
    isNaN(validLat) ||
    isNaN(validLng) ||
    validLat < -90 ||
    validLat > 90 ||
    validLng < -180 ||
    validLng > 180
  ) {
    throw new Error('Invalid geographic coordinates. Please select or search for your city.');
  }

  const query = buildOverpassQuery(validLat, validLng, validRadius);
  const body = `data=${encodeURIComponent(query)}`;

  let lastErr = null;

  // 1. Try public Overpass mirrors from the browser
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} from ${mirror}`);
      const data = await res.json();

      if (data && Array.isArray(data.elements)) {
        const seen = new Set();
        return data.elements
          .map(el => normaliseOsmElement(el, validLat, validLng))
          .filter(Boolean)
          .filter(d => {
            const key = `${d.name.toLowerCase()}|${(d.latitude ?? 0).toFixed(4)}|${(d.longitude ?? 0).toFixed(4)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
      }
    } catch (e) {
      lastErr = e;
      console.warn(`[Overpass Client] Mirror ${mirror} failed:`, e.message);
    }
  }

  // 2. Seamless fallback: call backend server-side endpoint
  try {
    const backendData = await apiRequest(`/doctors/nearby?lat=${validLat}&lng=${validLng}&radius=${validRadius}`);
    if (backendData && Array.isArray(backendData.doctors)) {
      return backendData.doctors;
    }
  } catch (backendErr) {
    console.warn('[Overpass Backend Fallback] Failed:', backendErr.message);
  }

  throw new Error(
    `Unable to load healthcare locations from OpenStreetMap servers. (${lastErr?.message || 'Network error'}). Please try again.`
  );
}

/**
 * Send raw OSM doctor list to backend for optional Gemini relevance notes.
 * Strictly non-blocking: never fails the main flow.
 */
export async function enrichDoctorsApi({ doctors }) {
  try {
    return await apiRequest('/doctors/enrich', {
      method: 'POST',
      body: JSON.stringify({ doctors }),
    });
  } catch (e) {
    console.warn('[Enrich] Gemini enrichment skipped:', e.message);
    return { success: true, doctors };
  }
}

/**
 * Send facial image to backend for OpenCV clinical filtering & illumination normalization
 */
export async function filterSkinImageApi(imagePayload) {
  return apiRequest('/analysis/filter', {
    method: 'POST',
    body: JSON.stringify({ image: imagePayload }),
  });
}

