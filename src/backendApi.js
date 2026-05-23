import { createClient } from '@supabase/supabase-js';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rumvtsrhzbckmzfujmmo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_NHPRoVKqve-rz6q5azBo7g_GsXJiqmz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function apiRequest(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

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
