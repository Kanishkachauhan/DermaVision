// utils/generateTokens.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';


export const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });

export const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');