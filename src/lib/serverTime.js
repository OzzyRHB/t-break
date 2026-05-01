/**
 * serverTime.js — clock-skew-corrected Date.now()
 *
 * Fetches the Supabase server time once, computes the offset between
 * server clock and local clock, and applies it to all subsequent calls.
 * This means even if a device clock is 5 minutes off, offeredAt and
 * all countdowns will be consistent across all clients.
 */

import { sb } from './supabase';

let _offset = 0;        // local - server (ms). Positive = local is ahead.
let _synced = false;
let _syncPromise = null;

export async function syncServerTime() {
  if (_synced) return;
  if (_syncPromise) return _syncPromise;

  _syncPromise = (async () => {
    try {
      const localBefore = Date.now();
      // Use Supabase's built-in now() via a lightweight RPC or select
      const { data, error } = await sb.rpc('get_server_time').single();
      const localAfter = Date.now();

      if (error || !data) {
        // Fallback: try reading updated_at from app_state
        const { data: s } = await sb.from('app_state')
          .select('updated_at').eq('id', 1).single();
        if (s?.updated_at) {
          const serverMs = new Date(s.updated_at).getTime();
          const roundTrip = localAfter - localBefore;
          const localAtServer = localBefore + roundTrip / 2;
          _offset = localAtServer - serverMs;
          _synced = true;
          console.log(`[serverTime] offset=${_offset}ms (via updated_at)`);
        }
        return;
      }

      const serverMs = new Date(data).getTime();
      const roundTrip = localAfter - localBefore;
      const localAtServer = localBefore + roundTrip / 2;
      _offset = localAtServer - serverMs;
      _synced = true;
      console.log(`[serverTime] offset=${_offset}ms`);
    } catch (e) {
      console.warn('[serverTime] sync failed, using local clock', e);
    }
  })();

  return _syncPromise;
}

/** Returns server-corrected current time in milliseconds */
export function serverNow() {
  return Date.now() - _offset;
}

export function isTimeSynced() {
  return _synced;
}
