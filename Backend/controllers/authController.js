// controllers/authController.js
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';
import { generateAccessToken, generateRefreshToken, hashToken } from '../utils/generateTokens.js';

const issueTokens = async (res, user) => {
    console.log("User ID passed:", user._id);//
     
  
  const accessToken = generateAccessToken(user._id);

  const decoded = jwt.decode(accessToken);//
  console.log("Token payload:", decoded);//
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return accessToken;
};

// @route POST /api/auth/register
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409);
    throw new Error('An account with this email already exists');
  }

  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  const user = await User.create({ name, email, password, otpCode, otpExpires });

  try {
    await sendEmail({
      to: email,
      subject: 'Verify your DermaVision account',
      html: `<p>Hi ${name},</p><p>Your verification code is <b>${otpCode}</b>. It expires in 10 minutes.</p>`,
    });
  } catch (err) {
    console.warn('[Email] Failed to send OTP email:', err.message);
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email with the OTP sent.',
    userId: user._id,
    // NOTE: for local Postman testing without SMTP set up, log the OTP here temporarily:
    devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
  });
});

// @route POST /api/auth/verify-otp
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select('+otpCode +otpExpires');

  if (!user || !user.otpCode || user.otpCode !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }
  if (user.otpExpires < new Date()) {
    res.status(400);
    throw new Error('OTP has expired, please request a new one');
  }

  user.isVerified = true;
  user.otpCode = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Email verified successfully. You may now log in.' });
});

// @route POST /api/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }
  if (!user.isVerified) {
    res.status(403);
    throw new Error('Please verify your email before logging in');
  }

  const accessToken = await issueTokens(res, user);
  res.json({ success: true, accessToken, user: user.toSafeObject() });
});

// @route POST /api/auth/refresh
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401);
    throw new Error('No refresh token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    res.status(401);
    throw new Error('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(token)) {
    res.status(401);
    throw new Error('Refresh token does not match, please log in again');
  }

  const accessToken = generateAccessToken(user._id);
  res.json({ success: true, accessToken });
});

// @route POST /api/auth/logout
export const logoutUser = asyncHandler(async (req, res) => {
  req.user.refreshTokenHash = undefined;
  await req.user.save();
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// @route POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

  try {
    await sendEmail({
      to: email,
      subject: 'Reset your DermaVision password',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Expires in 30 minutes.</p>`,
    });
  } catch (err) {
    console.warn('[Email] Failed to send reset email:', err.message);
  }

  res.json({
    success: true,
    message: 'If that email is registered, a reset link has been sent.',
    devResetToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
  });
});

// @route POST /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashed = hashToken(token);
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    res.status(400);
    throw new Error('Reset token is invalid or has expired');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successfully. You may now log in.' });
});