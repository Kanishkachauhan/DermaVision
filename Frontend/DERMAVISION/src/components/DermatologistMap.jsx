import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  HiOutlineRefresh,
  HiOutlinePhone,
  HiOutlineExternalLink,
  HiOutlineClock,
  HiCheckCircle,
} from 'react-icons/hi';
import { fetchOverpassDoctors } from '../utils/api';

// ─── Leaflet Marker Icon Fix for Vite / React ─────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const BRAND_COLOR = '#DC926E';

// ─── Custom Icons ─────────────────────────────────────────────────────────────
const createDoctorIcon = (isSelected) => {
  const scale = isSelected ? 'scale(1.15)' : 'scale(1)';
  const border = isSelected ? '3px solid #2B2623' : '2.5px solid #FFFFFF';

  return L.divIcon({
    className: 'custom-doctor-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 0.2s ease;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.2));">
        <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:${BRAND_COLOR};transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          <span style="transform:rotate(45deg);color:white;font-size:14px;line-height:1;">🩺</span>
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${BRAND_COLOR};margin-top:-1px;"></div>
      </div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -50],
  });
};

const createUserIcon = () =>
  L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div style="position:relative;width:26px;height:26px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.35);animation:pulse-ring 1.8s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 10px rgba(37,99,235,0.7);"></div>
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -18],
  });

// ─── Main DermatologistMap Component ──────────────────────────────────────────
const DermatologistMap = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayerGroup = useRef(null);
  const userMarkerRef = useRef(null);

  const [userPos, setUserPos] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // ── 1. Fetch Dermatologists from Overpass API ──────────────────────────────
  const fetchDoctors = useCallback(async (lat, lng) => {
    setLoading(true);
    try {
      const results = await fetchOverpassDoctors({ lat, lng, radius: 10000 });
      // Filter primarily for dermatologists or skin specialists
      const dermResults = results.filter(
        (d) => d.isDermatologyConfirmed || d.category === 'Dermatologist'
      );
      // Fallback to all nearby clinics if no explicit dermatology tags exist
      setDoctors(dermResults.length > 0 ? dermResults : results);
    } catch (err) {
      console.warn('[DermatologistMap] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── 2. Load Fallback Location if Geolocation Fails ─────────────────────────
  const loadFallbackLocation = useCallback(async (map) => {
    let lat = 28.9800;
    let lng = 77.7063;
    let label = 'Your Location';

    try {
      const res = await fetch('https://ipwho.is/');
      const data = await res.json();
      if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        lat = data.latitude;
        lng = data.longitude;
        if (data.city) label = `${data.city}`;
      }
    } catch (e) {
      console.warn('[Location] Network fallback failed, using default:', e.message);
    }

    if (map) {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<b>📍 ${label}</b>`)
        .openPopup();
      map.setView([lat, lng], 14);
    }

    setUserPos({ lat, lng, label });
    fetchDoctors(lat, lng);
  }, [fetchDoctors]);

  // ── 3. Exact User Location Detection Logic ─────────────────────────────────
  const locateUser = useCallback((map) => {
    if (!map) return;
    setLoading(true);

    if (!('geolocation' in navigator)) {
      console.error('Location error: Geolocation is not supported by this browser.');
      loadFallbackLocation(map);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log('Location:', lat, lng);

        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
        }

        userMarkerRef.current = L.marker([lat, lng])
          .addTo(map)
          .bindPopup('You are here')
          .openPopup();

        map.setView([lat, lng], 15);

        setUserPos({ lat, lng, label: 'You are here' });
        fetchDoctors(lat, lng);
      },
      (error) => {
        console.error('Location error:', error);
        // Fallback so user still sees clinics if macOS/browser blocked location
        loadFallbackLocation(map);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [fetchDoctors, loadFallbackLocation]);

  // ── 4. Initialize Map on Mount & Auto-Run Detection ─────────────────────────
  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [28.9800, 77.7063],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    // Street OpenStreetMap layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayerGroup.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    // Run exact location detection on the map
    locateUser(map);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstance.current = null;
    };
  }, [locateUser]);

  const handleRefresh = useCallback(() => {
    locateUser(mapInstance.current);
  }, [locateUser]);

  // ── 5. Render Markers & Auto-fit Bounds ─────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    const markersLayer = markersLayerGroup.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const bounds = L.latLngBounds();
    if (userPos) {
      bounds.extend([userPos.lat, userPos.lng]);
    }

    doctors.forEach((doctor) => {
      if (doctor.latitude == null || doctor.longitude == null) return;

      const isSelected = selectedDoctor?.id === doctor.id;
      const marker = L.marker([doctor.latitude, doctor.longitude], {
        icon: createDoctorIcon(isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      });

      const popupHtml = `
        <div style="font-family:inherit;min-width:200px;line-height:1.4;color:#2B2623;padding:2px;">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:${BRAND_COLOR};background:rgba(220,146,110,0.15);padding:2px 8px;border-radius:999px;">
            🩺 Dermatologist
          </span>
          <p style="margin:4px 0 2px;font-weight:800;font-size:13px;color:#2B2623;">
            ${doctor.name}
          </p>
          ${doctor.address ? `<p style="margin:0 0 6px;font-size:11px;color:#7A7069;">📍 ${doctor.address}</p>` : ''}
          ${doctor.distance !== null ? `<p style="margin:0 0 6px;font-size:11px;color:${BRAND_COLOR};font-weight:700;">📏 ${doctor.distance} km away</p>` : ''}
          <a href="${doctor.directionsUrl}" target="_blank" rel="noopener noreferrer"
             style="display:block;margin-top:6px;text-align:center;background:${BRAND_COLOR};color:#ffffff;padding:6px 0;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">
            🗺️ Get Directions
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260, closeButton: false });

      marker.on('click', () => {
        setSelectedDoctor(doctor);
        const cardEl = document.getElementById(`doctor-card-${doctor.id}`);
        cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      markersLayer.addLayer(marker);
      bounds.extend([doctor.latitude, doctor.longitude]);
    });

    if (bounds.isValid() && doctors.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [doctors, selectedDoctor, userPos]);

  // ── 6. Fly to Selected Doctor ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDoctor || !mapInstance.current) return;
    const { latitude, longitude } = selectedDoctor;
    if (latitude == null || longitude == null) return;

    mapInstance.current.flyTo([latitude, longitude], 15, { duration: 0.8 });

    markersLayerGroup.current?.eachLayer((layer) => {
      const latlng = layer.getLatLng();
      if (latlng.lat === latitude && latlng.lng === longitude) {
        layer.openPopup();
      }
    });
  }, [selectedDoctor]);

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* ── Status Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#7A7069]">
              <HiOutlineRefresh className="text-sm text-[#DC926E] animate-spin shrink-0" />
              <span>Detecting location &amp; searching nearby dermatologists…</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#2B2623]">
              <HiCheckCircle className="text-base text-emerald-600 shrink-0" />
              <span>
                Found {doctors.length} nearby dermatologist{doctors.length !== 1 ? 's' : ''} {userPos?.label ? `near ${userPos.label}` : ''}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs font-semibold text-[#7A7069] hover:text-[#DC926E] inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <HiOutlineRefresh className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Main Map & Doctor List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Leaflet Map */}
        <div
          className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-[#E8DFD8] overflow-hidden shadow-sm relative h-[320px] sm:h-[400px] lg:h-[480px] w-full"
        >
          <div
            ref={mapRef}
            id="leaflet-dermatologist-map"
            className="w-full h-full z-0"
          />

          {loading && (
            <div className="absolute inset-0 z-10 bg-slate-900/30 backdrop-blur-[1px] flex flex-col items-center justify-center text-white">
              <HiOutlineRefresh className="text-3xl text-white animate-spin mb-2" />
              <p className="text-xs font-bold tracking-wide">Finding nearby dermatologists…</p>
            </div>
          )}
        </div>

        {/* Doctor List */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3">
          <div
            className="space-y-3 overflow-y-auto pr-1 max-h-[360px] sm:max-h-[440px] lg:max-h-[480px]"
          >
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-[#E8DFD8] rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="h-4 bg-[#F3EDE8] rounded-full w-24 animate-pulse" />
                    <div className="h-5 bg-[#F3EDE8] rounded-md w-3/4 animate-pulse" />
                    <div className="h-3.5 bg-[#F3EDE8] rounded-md w-full animate-pulse" />
                    <div className="h-8 bg-[#F3EDE8] rounded-xl w-full animate-pulse mt-2" />
                  </div>
                ))}
              </div>
            )}

            {!loading && doctors.length === 0 && (
              <div className="bg-white border border-[#E8DFD8] rounded-2xl p-6 text-center space-y-2">
                <div className="text-3xl">🩺</div>
                <h4 className="text-sm font-bold text-[#2B2623]">No dermatologists found nearby</h4>
                <p className="text-xs text-[#7A7069]">No clinics were recorded in OpenStreetMap within 10 km.</p>
              </div>
            )}

            {!loading &&
              doctors.map((doctor) => {
                const isSelected = selectedDoctor?.id === doctor.id;
                return (
                  <div
                    key={doctor.id}
                    id={`doctor-card-${doctor.id}`}
                    onClick={() => setSelectedDoctor(isSelected ? null : doctor)}
                    className={`text-left p-4 rounded-2xl transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#FEF6F2] border-[#DC926E] shadow-md ring-2 ring-[#DC926E]/20'
                        : 'bg-white border-[#E8DFD8] hover:border-[#DC926E]/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DC926E]/15 text-[#DC926E]">
                        🩺 Dermatologist
                      </span>
                      {doctor.distance !== null && (
                        <span className="text-xs font-bold text-[#DC926E] bg-[#FEF3ED] border border-[#FECBA1] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          {doctor.distance} km away
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-[#2B2623] leading-snug line-clamp-2 mb-1">
                      {doctor.name}
                    </h4>

                    {doctor.address && (
                      <p className="text-xs text-[#7A7069] leading-relaxed mb-2 line-clamp-2">
                        📍 {doctor.address}
                      </p>
                    )}

                    {/* Contact & Hours */}
                    <div className="space-y-1.5 text-xs text-[#5A524C]">
                      {doctor.openingHours && (
                        <div className="flex items-center gap-1.5 text-[#5A524C]">
                          <HiOutlineClock className="text-sm text-[#7A7069] flex-shrink-0" />
                          <span>{doctor.openingHours}</span>
                        </div>
                      )}

                      {doctor.phone && (
                        <a
                          href={`tel:${doctor.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#2B2623] hover:text-[#DC926E] transition-colors"
                        >
                          <HiOutlinePhone className="text-sm text-[#DC926E] flex-shrink-0" />
                          <span>{doctor.phone}</span>
                        </a>
                      )}

                      {doctor.website && (
                        <div>
                          <a
                            href={doctor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[#DC926E] font-semibold hover:underline"
                          >
                            <span>Visit Website</span>
                            <HiOutlineExternalLink className="text-xs" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Directions */}
                    <div className="mt-3 pt-2 border-t border-[#E8DFD8]">
                      <a
                        href={doctor.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-[#DC926E] hover:bg-[#c87e5b] text-white text-xs font-bold py-2 px-3 rounded-xl shadow-sm transition-all"
                      >
                        <span>Get Directions</span>
                        <HiOutlineExternalLink className="text-xs" />
                      </a>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.85; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          border: 1px solid #E8DFD8 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
          padding: 4px !important;
        }
        .leaflet-popup-content {
          margin: 10px 12px !important;
        }
        .leaflet-popup-tip {
          background: #FFFFFF !important;
        }
      `}</style>
    </div>
  );
};

export default DermatologistMap;
