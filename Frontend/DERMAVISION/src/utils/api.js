// src/utils/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Shared fetch wrapper for backend API requests
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('dermavision_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: 'include',
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Backend returns { message: '...' } or express-validator { errors: [...] }
      const errorMsg =
        data.message ||
        (Array.isArray(data.errors) && data.errors[0]?.msg) ||
        `Request failed with status ${response.status}`;

      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      const connErr = new Error(
        'Cannot connect to backend server. Please ensure the backend is running on port 5001.'
      );
      connErr.status = 503;
      throw connErr;
    }
    throw err;
  }
}
