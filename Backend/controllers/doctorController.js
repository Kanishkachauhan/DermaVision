// Backend/controllers/doctorController.js
/**
 * Doctor Controller
 *
 * Architecture:
 *   Frontend → Overpass API (browser direct for low latency and zero API key requirement)
 *   Backend  → Overpass API fallback endpoint (GET /api/doctors/nearby)
 *   Backend  → Gemini category/relevance enrichment (POST /api/doctors/enrich, optional)
 *
 * All data sourced exclusively from OpenStreetMap via free Overpass API.
 * No Google Places, no Google Maps API keys, no paid services.
 */
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const OVERPASS_MIRRORS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const haversine = (lat1, lng1, lat2, lng2) => {
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
 * Builds the dynamic Overpass QL query searching for nearby healthcare facilities
 */
const buildQuery = (lat, lng, radius) => {
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
 * Accurately categorises an OSM healthcare element into:
 * "Dermatologist" (if explicit dermatology tag or name)
 * "Clinic", "Doctor", "Hospital", or "Healthcare"
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
 * Normalises raw OSM element into a clean, well-formed facility object
 */
const normalise = (el, userLat, userLng) => {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;

  const rawName = tags.name || tags['name:en'] || tags.operator || tags.brand || null;
  const name = rawName || 'Unnamed healthcare facility';

  const { category, isDermatologyConfirmed } = determineCategory(tags, name);

  // Free OpenStreetMap directions routing URL
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
    distance: lat !== null && lng !== null ? haversine(userLat, userLng, lat, lng) : null,
    rating: null, // Strictly no fake ratings
    directionsUrl,
    osmType: tags.amenity || tags.healthcare || 'medical',
    osmSpeciality: tags['healthcare:speciality'] || tags['speciality'] || null,
  };
};

/**
 * Optional Gemini categorisation and relevance insight
 * Note: Never invents factual data (names, ratings, addresses, phones)
 */
const categorizeWithGemini = async (doctors) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || doctors.length === 0) {
    return doctors.map(d => ({ ...d, relevance: null }));
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const miniList = doctors.slice(0, 30).map((d, i) => ({
      index: i,
      name: d.name,
      category: d.category,
      osmType: d.osmType || '',
      osmSpeciality: d.osmSpeciality || '',
    }));

    const prompt = `
You are a medical directory assistant for a dermatology app.
The user wants to find dermatologists and skin clinics.
For each facility in the JSON array, return a short helpful sentence (max 10 words) about its relevance to skincare or healthcare.
Do not invent phone numbers, addresses, ratings, or doctor names.

Format: return ONLY a valid JSON array:
[{"index": 0, "relevance": "Skin and aesthetic clinic offering dermatology consultations."}]

Facilities:
${JSON.stringify(miniList)}
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return doctors.map(d => ({ ...d, relevance: null }));

    const parsed = JSON.parse(jsonMatch[0]);
    return doctors.map((d, i) => {
      const match = parsed.find(p => p.index === i);
      return {
        ...d,
        relevance: match?.relevance || null,
      };
    });
  } catch (err) {
    console.warn('[Gemini] Note generation skipped:', err.message);
    return doctors.map(d => ({ ...d, relevance: null }));
  }
};

/**
 * POST /api/doctors/enrich
 * Optional enrichment route for frontend
 */
export const enrichDoctors = async (req, res, next) => {
  try {
    const { doctors } = req.body;

    if (!Array.isArray(doctors)) {
      return res.status(400).json({ success: false, message: '`doctors` must be an array.' });
    }

    if (doctors.length === 0) {
      return res.status(200).json({ success: true, doctors: [] });
    }

    const enriched = await categorizeWithGemini(doctors);
    return res.status(200).json({ success: true, doctors: enriched });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/doctors/nearby
 * Server-side Overpass lookup fallback
 */
export const getNearbyDoctors = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = Math.min(Math.max(parseInt(req.query.radius) || 5000, 1000), 50000);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates provided.' });
    }

    const query = buildQuery(lat, lng, radius);
    let overpassData = null;
    let lastErr = null;

    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const response = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'DermaVisionApp/1.0 (healthcare-finder)',
          },
          timeout: 25000,
        });

        if (response.data && response.data.elements) {
          overpassData = response.data;
          break;
        }
      } catch (e) {
        lastErr = e;
        console.warn(`[Overpass Server] Mirror ${mirror} failed:`, e.message);
      }
    }

    if (!overpassData) {
      return res.status(502).json({
        success: false,
        message: 'Could not connect to OpenStreetMap Overpass servers. Please try again.',
        detail: lastErr?.message,
      });
    }

    const seen = new Set();
    const normalised = (overpassData.elements || [])
      .map(el => normalise(el, lat, lng))
      .filter(Boolean)
      .filter(d => {
        const key = `${d.name.toLowerCase()}|${(d.latitude ?? 0).toFixed(4)}|${(d.longitude ?? 0).toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));

    return res.status(200).json({
      success: true,
      source: 'OpenStreetMap (Overpass)',
      attribution: '© OpenStreetMap contributors',
      location: { latitude: lat, longitude: lng },
      radius,
      total: normalised.length,
      doctors: normalised,
    });
  } catch (err) {
    next(err);
  }
};
