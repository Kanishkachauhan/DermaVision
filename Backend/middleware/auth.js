// middleware/auth.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded:", decoded);
    const user = await User.findById(decoded.id);
     console.log("User:", user);
     
    if (!user || !user.isActive) {
      res.status(401);
      throw new Error('Not authorized, user no longer exists or is deactivated');
    }

    req.user = user;
    next();
  } catch (err) {
  console.error(err);

  res.status(401);
  throw new Error(err.message);
}
});

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403);
  throw new Error('Admin access required');
};