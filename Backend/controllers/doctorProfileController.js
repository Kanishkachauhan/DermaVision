import asyncHandler from 'express-async-handler';
import Doctor, { makeDoctorProfileKey } from '../models/doctor.js';

const doctorFields = [
  'clinicName',
  'doctorName',
  'address',
  'contactNumber',
  'latitude',
  'longitude',
  'consultationTimings',
  'rating',
  'totalReviews',
  'profileImage',
  'specialization',
  'isActive',
];

const getDoctorInput = (body) =>
  Object.fromEntries(doctorFields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]));

const throwDuplicateProfileError = (error, res) => {
  if (error.code === 11000) {
    res.status(409);
    throw new Error('A doctor with this name is already registered at this clinic');
  }
  throw error;
};

export const getActiveDoctors = asyncHandler(async (_req, res) => {
  const doctors = await Doctor.find({ isActive: true })
    .select('-profileKey')
    .sort({ clinicName: 1, doctorName: 1 })
    .lean();

  res.json({ success: true, doctors });
});

export const listDoctors = asyncHandler(async (_req, res) => {
  const doctors = await Doctor.find()
    .select('-profileKey')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, doctors });
});

export const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).select('-profileKey').lean();
  if (!doctor) {
    res.status(404);
    throw new Error('Doctor not found');
  }
  res.json({ success: true, doctor });
});

export const createDoctor = asyncHandler(async (req, res) => {
  const input = getDoctorInput(req.body);
  if (await Doctor.exists({ profileKey: makeDoctorProfileKey(input.clinicName, input.doctorName) })) {
    res.status(409);
    throw new Error('A doctor with this name is already registered at this clinic');
  }

  try {
    const doctor = await Doctor.create(input);
    const result = doctor.toObject();
    delete result.profileKey;
    res.status(201).json({ success: true, doctor: result });
  } catch (error) {
    throwDuplicateProfileError(error, res);
  }
});

export const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) {
    res.status(404);
    throw new Error('Doctor not found');
  }

  const input = getDoctorInput(req.body);
  if (await Doctor.exists({
    profileKey: makeDoctorProfileKey(input.clinicName, input.doctorName),
    _id: { $ne: doctor._id },
  })) {
    res.status(409);
    throw new Error('A doctor with this name is already registered at this clinic');
  }

  doctor.set(input);
  try {
    await doctor.save();
  } catch (error) {
    throwDuplicateProfileError(error, res);
  }

  const result = doctor.toObject();
  delete result.profileKey;
  res.json({ success: true, doctor: result });
});

export const deleteDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) {
    res.status(404);
    throw new Error('Doctor not found');
  }
  res.json({ success: true, message: 'Doctor profile deleted' });
});

export const updateDoctorStatus = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) {
    res.status(404);
    throw new Error('Doctor not found');
  }

  doctor.isActive = req.body.isActive;
  await doctor.save();

  const result = doctor.toObject();
  delete result.profileKey;
  res.json({ success: true, doctor: result });
});
