// models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
        type: String,
        required: [true, 'Name is required'],
         trim: true, 
        maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
        type: String, 
        required: [true, 'Password is required'],
        minlength: 8,
        select: false
     },
    role: { 
       type: String,
       enum: ['user', 'admin'],
       default: 'user' 
    },
    avatarUrl: {
         type: String,
         default: '' },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say',
    },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Return user without sensitive fields
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();

  delete obj.password;
  delete obj.refreshTokenHash;
  delete obj.otpCode;
  delete obj.otpExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;