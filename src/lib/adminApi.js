// src/lib/adminApi.js
// All calls go through the admin-users Edge Function which runs with the service role key.
// The service role key is NEVER in the browser.

import { sb } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

async function call(action, payload = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export const adminApi = {
  // List all auth users merged with their profiles
  listUsers: () => call('list'),

  // Create a user with email + temp password, auto-approved
  createUser: (email, name, tempPassword, team, makeLeader) =>
    call('create', { email, name, tempPassword, team, makeLeader }),

  // Delete auth account + profile row
  deleteUser: (userId) => call('delete', { userId }),

  // Force-set a new password (admin sets it, shares with user)
  setPassword: (userId, newPassword) => call('set_password', { userId, newPassword }),

  // Send password reset email
  sendReset: (email) =>
    call('send_reset', { email, redirectTo: window.location.origin + '/' }),

  // Update profile fields (name, team, is_leader, approved)
  updateProfile: (userId, patch) => call('update_profile', { userId, patch }),
};
