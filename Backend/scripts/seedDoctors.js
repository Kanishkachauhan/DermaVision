import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Doctor, { makeDoctorProfileKey } from '../models/doctor.js';

dotenv.config();

const doctors = [
  {
    clinicName: `Derma With Me \u2013 Advanced Skin & Hair Clinic`,
    doctorName: 'Dr. Mohak Agarwal',
    address: 'B-96, opposite Dr. Tarun Agarwal, Gandhi Nagar, Moradabad, Uttar Pradesh 244001.',
    contactNumber: '+91 82720 50035',
    latitude: 28.8284977,
    longitude: 78.7722646,
    consultationTimings: `Monday\u2013Saturday: 10:30 AM\u20133:30 PM; Sunday: Closed`,
    rating: 4.9,
    totalReviews: 193,
    profileImage: '',
    specialization: 'Dermatology',
    isActive: true,
  },
  {
    clinicName: 'Aura Skin & Hair Clinic',
    doctorName: 'Dr. Ashwin, Dr. Harshita Sharma',
    address: 'A-69, Gandhi Nagar Road, near Manoj Sweet, Moradabad, Uttar Pradesh 244001.',
    contactNumber: '+91 99708 26576',
    latitude: 28.826863,
    longitude: 78.775248,
    consultationTimings: 'Monday-Saturday: 5:00 PM-8:30 PM; Sunday: 11:00 AM-2:00 PM.',
    rating: 4.9,
    totalReviews: 132,
    profileImage: '',
    specialization: 'Dermatology',
    isActive: true,
  },
  {
    clinicName: 'Dr. Vikas Gupta Skin Care Clinic',
    doctorName: 'Dr. Vikas Gupta',
    address: 'A-73, Prince Road, opposite Wajid Nagar Complex, Gandhi Nagar, Moradabad, Uttar Pradesh 244001.',
    contactNumber: '+91 82731 12888',
    latitude: 28.82864,
    longitude: 78.77525,
    consultationTimings: 'Monday-Saturday: 10:00 AM-5:00 PM; Sunday: Closed.',
    rating: 4.5,
    totalReviews: 626,
    profileImage: '',
    specialization: 'Dermatology',
    isActive: true,
  },
  {
    clinicName: 'RHC Laser & Aesthetics',
    doctorName: 'Not available',
    address: '8/6/8-C, near Commissioner Residence, Civil Lines, Moradabad, Uttar Pradesh 244001.',
    contactNumber: '+91 91054 32606',
    latitude: null,
    longitude: null,
    consultationTimings: 'Monday-Saturday: 10:30 AM-4:00 PM; Sunday: Closed.',
    rating: 4.9,
    totalReviews: 64,
    profileImage: '',
    specialization: 'Skin & Hair Specialist',
    isActive: true,
  },
];

try {
  await connectDB();
  for (const doctor of doctors) {
    const profileKey = makeDoctorProfileKey(doctor.clinicName, doctor.doctorName);
    const result = await Doctor.updateOne(
      { profileKey },
      { $setOnInsert: { ...doctor, profileKey } },
      { upsert: true, runValidators: true }
    );
    console.log(
      result.upsertedCount
        ? `[Seed] Added ${doctor.clinicName}.`
        : `[Seed] ${doctor.clinicName} already exists.`
    );
  }
} catch (error) {
  console.error('[Seed] Failed to seed initial dermatologist:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
