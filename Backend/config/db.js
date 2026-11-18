// config/db.js
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('[MongoDB] Warning: MONGO_URI is not set. Continuing in offline mode...');
      return;
    }
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`[MongoDB] Warning: Database connection issue (${error.message}). Operating in resilient mode...`);
  }
};

export default connectDB;