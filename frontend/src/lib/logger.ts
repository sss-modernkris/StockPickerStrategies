import { API_BASE_URL } from './api';

/**
 * A simple logger utility that both logs to the browser console
 * and sends the log to the backend to be visible in Docker logs.
 */
export const logger = {
  log: (message: string, data?: any) => send('info', message, data),
  info: (message: string, data?: any) => send('info', message, data),
  warn: (message: string, data?: any) => send('warn', message, data),
  error: (message: string, data?: any) => send('error', message, data),
};

const send = (level: string, message: string, data?: any) => {
  // Always log to local console first
  if (data) {
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  } else {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  // Send to backend for Docker visibility
  fetch(`${API_BASE_URL}/api/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      level, 
      message, 
      // Ensure data is serializable for the backend
      data: data !== undefined ? data : null 
    }),
  }).catch(() => {
    // Silently ignore logging failures to not disrupt the app
  });
};
