// Backend/utils/aiServerManager.js
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8008';

let isStarting = false;

export async function checkAIServerHealth() {
  try {
    const res = await axios.get(`${AI_URL}/api/health`, { timeout: 800 });
    return res.data?.status === 'online';
  } catch {
    return false;
  }
}

export async function ensureAIServerRunning() {
  const healthy = await checkAIServerHealth();
  if (healthy) {
    console.log('[AI Manager] Python AI microservice is online on port 8008.');
    return true;
  }

  if (isStarting) {
    return false;
  }

  isStarting = true;
  console.log('[AI Manager] Python AI microservice is offline. Attempting background start...');

  const serviceDir = path.resolve(__dirname, '../../Model/05_api_service');
  const serverScript = path.join(serviceDir, 'server.py');

  try {
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pyCmd, [serverScript], {
      cwd: serviceDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    child.on('error', (err) => {
      console.warn('[AI Manager] Background Python process note:', err.message);
      isStarting = false;
    });

    child.unref();
    console.log(`[AI Manager] Spawned Python AI process (PID: ${child.pid}) using ${pyCmd}`);

    // Quick single-second check so we don't stall HTTP requests
    await new Promise((r) => setTimeout(r, 1000));
    const up = await checkAIServerHealth();
    isStarting = false;
    return up;
  } catch (err) {
    console.warn('[AI Manager] Python AI microservice start bypassed:', err.message);
    isStarting = false;
    return false;
  }
}
