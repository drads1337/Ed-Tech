import { createClient } from '@supabase/supabase-js';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rumvtsrhzbckmzfujmmo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_NHPRoVKqve-rz6q5azBo7g_GsXJiqmz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function apiRequest(path, { token, demoUser = 'user_admin', method = 'GET', body } = {}) {
  const requestBody = typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;

  const buildRequest = (requestToken) => ({
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      ...(!requestToken && demoUser ? { 'X-Demo-User': demoUser } : {}),
    },
    body: requestBody,
  });

  let response = await fetch(`${API_BASE_URL}${path}`, buildRequest(token));

  let payload = await response.json().catch(() => null);

  if (token && demoUser && response.status === 401 && payload?.detail === 'Invalid token.') {
    response = await fetch(`${API_BASE_URL}${path}`, buildRequest(null));
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Request failed.');
  }

  return payload;
}

export async function apiFormRequest(path, { token, demoUser = 'user_admin', method = 'POST', formData } = {}) {
  const buildRequest = (requestToken) => ({
    method,
    headers: {
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
      ...(!requestToken && demoUser ? { 'X-Demo-User': demoUser } : {}),
    },
    body: formData,
  });

  let response = await fetch(`${API_BASE_URL}${path}`, buildRequest(token));

  let payload = await response.json().catch(() => null);

  if (token && demoUser && response.status === 401 && payload?.detail === 'Invalid token.') {
    response = await fetch(`${API_BASE_URL}${path}`, buildRequest(null));
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Request failed.');
  }

  return payload;
}

export async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  return data.session?.access_token || null;
}
