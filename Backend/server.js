// server.js
import dotenv from 'dotenv';
dotenv.config();

import connectDB from './config/db.js';
import app from './app.js';
import { ensureAIServerRunning } from './utils/aiServerManager.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
    // Asynchronously ensure Python AI microservice is active
    ensureAIServerRunning().catch((err) => {
      console.warn('[Server] Note: AI server auto-check completed:', err.message);
    });
  });
};

start();