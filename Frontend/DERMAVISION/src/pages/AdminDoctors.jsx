import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineSearch, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineRefresh, HiX } from 'react-icons/hi';
import { apiRequest } from '../utils/api';

const EMPTY_DOCTOR = {
  clinicName: '',
  doctorName: '',
  address: '',
  contactNumber: '',
  latitude: '',
  longitude: '',
  consultationTimings: '',
  rating: '0',
  totalReviews: '0',
  profileImage: '',
  specialization: 'Dermatology',
  isActive: true,
};

const inputClass = 'mt-1.5 w-full rounded-xl border border-[#E8DFD8] bg-white px-3.5 py-2.5 text-sm text-[#2B2623] outline-none transition focus:border-[#DC926E] focus:ring-2 focus:ring-[#DC926E]/15';

const formFromDoctor = (doctor) => ({
  ...EMPTY_DOCTOR,
  ...doctor,
  latitude: doctor.latitude == null ? '' : String(doctor.latitude),
  longitude: doctor.longitude == null ? '' : String(doctor.longitude),
  rating: String(doctor.rating),
  totalReviews: String(doctor.totalReviews),
});

const AdminDoctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [form, setForm] = useState(EMPTY_DOCTOR);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/admin/doctors');
      setDoctors(data.doctors || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return doctors;
    return doctors.filter((doctor) =>
      [doctor.doctorName, doctor.clinicName, doctor.address]
        .some((value) => value?.toLocaleLowerCase().includes(query))
    );
  }, [doctors, search]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingDoctor(null);
  };

  const openCreate = () => {
    setError('');
    setForm(EMPTY_DOCTOR);
    setEditingDoctor(null);
    setModalOpen(true);
  };

  const openEdit = async (doctor) => {
    setError('');
    setSaving(true);
    try {
      const data = await apiRequest(`/admin/doctors/${doctor._id}`);
      setEditingDoctor(data.doctor);
      setForm(formFromDoctor(data.doctor));
      setModalOpen(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      ...form,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      rating: Number(form.rating),
      totalReviews: Number(form.totalReviews),
      profileImage: form.profileImage.trim(),
    };

    try {
      await apiRequest(editingDoctor ? `/admin/doctors/${editingDoctor._id}` : '/admin/doctors', {
        method: editingDoctor ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setEditingDoctor(null);
      setNotice(editingDoctor ? 'Doctor profile updated.' : 'Doctor profile added.');
      await loadDoctors();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doctor) => {
    if (!window.confirm(`Delete Dr. ${doctor.doctorName.replace(/^Dr\.?\s*/i, '')} at ${doctor.clinicName}? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/doctors/${doctor._id}`, { method: 'DELETE' });
      setNotice('Doctor profile deleted.');
      await loadDoctors();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleStatusToggle = async (doctor) => {
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/doctors/${doctor._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !doctor.isActive }),
      });
      setNotice(`${doctor.doctorName} is now ${doctor.isActive ? 'inactive' : 'active'}.`);
      await loadDoctors();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-12">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#DC926E]">Admin dashboard</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#2B2623] sm:text-3xl">Manage Doctors</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#7A7069]">Keep the dermatologist directory accurate and up to date.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#DC926E] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#c87e5b]"
        >
          <HiOutlinePlus className="text-lg" />
          Add doctor
        </button>
      </div>

      {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-[#E8DFD8] bg-white p-4">
          <p className="text-xs font-semibold text-[#7A7069]">All profiles</p>
          <p className="mt-1 text-2xl font-extrabold text-[#2B2623]">{doctors.length}</p>
        </div>
        <div className="rounded-2xl border border-[#E8DFD8] bg-white p-4">
          <p className="text-xs font-semibold text-[#7A7069]">Active profiles</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{doctors.filter((doctor) => doctor.isActive).length}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <HiOutlineSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[#9A8F87]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by doctor, clinic, or location"
            className={`${inputClass} mt-0 pl-10`}
            aria-label="Search doctors by name, clinic, or location"
          />
        </label>
        <button
          type="button"
          onClick={loadDoctors}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8DFD8] bg-white px-4 py-2.5 text-sm font-semibold text-[#5A524C] transition hover:border-[#DC926E] disabled:opacity-50"
        >
          <HiOutlineRefresh className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading doctor profiles">
          {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-[#E8DFD8] bg-white" />)}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8C9BF] bg-white px-5 py-14 text-center">
          <p className="text-lg font-bold text-[#2B2623]">{search ? 'No matching doctors' : 'No doctor profiles yet'}</p>
          <p className="mt-2 text-sm text-[#7A7069]">{search ? 'Try another name, clinic, or location.' : 'Add a dermatologist to start building your directory.'}</p>
          {!search && <button type="button" onClick={openCreate} className="mt-5 rounded-xl bg-[#DC926E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#c87e5b]">Add first doctor</button>}
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDoctors.map((doctor) => (
            <article key={doctor._id} className="overflow-hidden rounded-2xl border border-[#E8DFD8] bg-white shadow-sm">
              <div className="flex items-start gap-3 border-b border-[#F0E9E4] p-4">
                {doctor.profileImage ? (
                  <img src={doctor.profileImage} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#FAF1EC] text-2xl" aria-hidden="true">🩺</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-[#2B2623]">{doctor.doctorName}</h2>
                      <p className="mt-0.5 line-clamp-2 text-xs font-medium text-[#7A7069]">{doctor.clinicName}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${doctor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {doctor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-amber-600">★ {doctor.rating.toFixed(1)} <span className="font-normal text-[#7A7069]">({doctor.totalReviews} reviews)</span></p>
                </div>
              </div>

              <dl className="space-y-2.5 p-4 text-xs">
                <div><dt className="font-bold text-[#5A524C]">Address</dt><dd className="mt-0.5 leading-relaxed text-[#7A7069]">{doctor.address}</dd></div>
                <div><dt className="font-bold text-[#5A524C]">Contact</dt><dd className="mt-0.5 text-[#7A7069]">{doctor.contactNumber}</dd></div>
                <div><dt className="font-bold text-[#5A524C]">Consultation</dt><dd className="mt-0.5 leading-relaxed text-[#7A7069]">{doctor.consultationTimings}</dd></div>
                <div className="flex justify-between gap-3">
                  <div><dt className="font-bold text-[#5A524C]">Specialization</dt><dd className="mt-0.5 text-[#7A7069]">{doctor.specialization}</dd></div>
                  <div className="text-right"><dt className="font-bold text-[#5A524C]">Coordinates</dt><dd className="mt-0.5 text-[#7A7069]">{doctor.latitude == null ? 'Not provided' : `${doctor.latitude}, ${doctor.longitude}`}</dd></div>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 border-t border-[#F0E9E4] p-3">
                <button type="button" onClick={() => handleStatusToggle(doctor)} className="flex-1 rounded-lg border border-[#E8DFD8] px-2.5 py-2 text-xs font-bold text-[#5A524C] transition hover:border-[#DC926E] hover:text-[#DC926E]">
                  {doctor.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => openEdit(doctor)} disabled={saving} aria-label={`Edit ${doctor.doctorName}`} className="rounded-lg border border-[#E8DFD8] p-2 text-[#5A524C] transition hover:border-[#DC926E] hover:text-[#DC926E] disabled:opacity-50">
                  <HiOutlinePencil className="text-base" />
                </button>
                <button type="button" onClick={() => handleDelete(doctor)} aria-label={`Delete ${doctor.doctorName}`} className="rounded-lg border border-red-100 p-2 text-red-600 transition hover:border-red-300 hover:bg-red-50">
                  <HiOutlineTrash className="text-base" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#211b18]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <div role="dialog" aria-modal="true" aria-labelledby="doctor-form-title" className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-[#FAF8F5] shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8DFD8] bg-[#FAF8F5] px-5 py-4 sm:px-7">
              <div>
                <h2 id="doctor-form-title" className="text-lg font-extrabold text-[#2B2623]">{editingDoctor ? 'Edit doctor profile' : 'Add doctor profile'}</h2>
                <p className="mt-0.5 text-xs text-[#7A7069]">Fields marked with * are required.</p>
              </div>
              <button type="button" onClick={closeModal} disabled={saving} aria-label="Close form" className="rounded-lg p-2 text-[#7A7069] transition hover:bg-[#F0E9E4]"><HiX className="text-xl" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#5A524C]">Hospital / Clinic Name *
                  <input required name="clinicName" value={form.clinicName} onChange={updateField} maxLength={160} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Doctor Name *
                  <input required name="doctorName" value={form.doctorName} onChange={updateField} maxLength={120} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C] sm:col-span-2">Address *
                  <textarea required name="address" value={form.address} onChange={updateField} rows={2} maxLength={500} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Contact Number *
                  <input required type="tel" name="contactNumber" value={form.contactNumber} onChange={updateField} placeholder="+91 98765 43210" className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Specialization *
                  <select required name="specialization" value={form.specialization} onChange={updateField} className={inputClass}>
                    <option>Dermatology</option>
                    <option>Skin &amp; Hair Specialist</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Latitude *
                  <input type="number" step="any" min="-90" max="90" name="latitude" value={form.latitude} onChange={updateField} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Longitude *
                  <input type="number" step="any" min="-180" max="180" name="longitude" value={form.longitude} onChange={updateField} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C] sm:col-span-2">Consultation Timings *
                  <textarea required name="consultationTimings" value={form.consultationTimings} onChange={updateField} rows={2} maxLength={300} placeholder="Monday–Saturday: 10:30 AM–3:30 PM; Sunday: Closed" className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Rating (out of 5) *
                  <input required type="number" step="0.1" min="0" max="5" name="rating" value={form.rating} onChange={updateField} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C]">Total Reviews *
                  <input required type="number" step="1" min="0" name="totalReviews" value={form.totalReviews} onChange={updateField} className={inputClass} />
                </label>
                <label className="text-xs font-bold text-[#5A524C] sm:col-span-2">Profile Image URL <span className="font-normal text-[#9A8F87]">(optional)</span>
                  <input type="url" name="profileImage" value={form.profileImage} onChange={updateField} placeholder="https://example.com/doctor-photo.jpg" className={inputClass} />
                  {form.profileImage && <img src={form.profileImage} alt="Doctor profile preview" className="mt-3 h-20 w-20 rounded-xl object-cover" />}
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#5A524C] sm:col-span-2">
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={updateField} className="h-4 w-4 accent-[#DC926E]" />
                  Active profile (visible in the dermatologist finder)
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#E8DFD8] pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeModal} disabled={saving} className="rounded-xl border border-[#E8DFD8] px-4 py-2.5 text-sm font-bold text-[#5A524C] hover:bg-white disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#DC926E] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#c87e5b] disabled:cursor-wait disabled:opacity-60">
                  {saving ? 'Saving…' : editingDoctor ? 'Save changes' : 'Add doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminDoctors;
