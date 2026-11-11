import mongoose from 'mongoose';

const isValidPhoneNumber = (value) => {
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

export const makeDoctorProfileKey = (clinicName, doctorName) => {
  const normalize = (value) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalize(clinicName)}::${normalize(doctorName)}`;
};

const doctorSchema = new mongoose.Schema(
  {
    clinicName: {
      type: String,
      required: [true, 'Hospital or clinic name is required'],
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    doctorName: {
      type: String,
      required: [true, 'Doctor name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    address: {
      type: String,
      required: [true, 'Clinic address is required'],
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      validate: {
        validator: isValidPhoneNumber,
        message: 'Enter a valid phone number',
      },
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    consultationTimings: {
      type: String,
      required: [true, 'Consultation timings are required'],
      trim: true,
      maxlength: 300,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      required: true,
      min: 0,
      max: 10000000,
      validate: Number.isInteger,
    },
    profileImage: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2048,
      validate: {
        validator: (value) => !value || /^https?:\/\/\S+$/i.test(value),
        message: 'Profile image must be an HTTP or HTTPS URL',
      },
    },
    specialization: {
      type: String,
      required: true,
      enum: ['Dermatology', 'Skin & Hair Specialist'],
      default: 'Dermatology',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileKey: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
  },
  { timestamps: true }
);

doctorSchema.pre('validate', function () {
  if (this.clinicName && this.doctorName) {
    this.profileKey = makeDoctorProfileKey(this.clinicName, this.doctorName);
  }

  if ((this.latitude == null) !== (this.longitude == null)) {
    this.invalidate('latitude', 'Latitude and longitude must both be provided or both be left blank');
    this.invalidate('longitude', 'Latitude and longitude must both be provided or both be left blank');
  }
});

doctorSchema.index({ isActive: 1, doctorName: 1 });

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;
