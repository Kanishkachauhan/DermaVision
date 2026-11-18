// server.js
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import connectDB from './config/db.js';
import app from './app.js';
import { ensureAIServerRunning } from './utils/aiServerManager.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
    // Asynchronously ensure Python AI microservice is active in background
    ensureAIServerRunning().catch((err) => {
      console.warn('[Server] Note: AI server auto-check completed:', err.message);
    });
  });
};

start();