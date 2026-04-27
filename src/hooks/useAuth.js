import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { registerSession, insertLog } from '../lib/state';


// Promise that resolves after ms milliseconds with null
const timeout = (ms) => new Promise(res => setTimeout(() => res(null), ms));

// Race a promise against a timeout
const withTimeout = (promise, ms) => Promise.race([promise, timeout(ms)]);

export function useAuth() {
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authCheckedRef = useRef(false);

  const markChecked = () => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    setAuthChecked(true);
  };

  const applySession = async (session) => {
    if (!session?.user) return false;
    try {
      // 5s timeout on profile query — don't hang forever
      const result = await withTimeout(
        sb.from('profiles').select('*').eq('id', session.user.id).single(),
        5000
      );

      if (!result) {
        console.warn('[auth] Profile query timed out');
        return false;
      }

      const { data: profile, error } = result;

      if (error) {
        console.warn('[auth] Profile error:', error.code, error.message);
        // If permissions error (not "row not found"), try token refresh once
        if (error.code !== 'PGRST116') {
          const refreshResult = await withTimeout(sb.auth.refreshSession(), 4000);
          if (refreshResult?.data?.session) {
            const retry = await withTimeout(
              sb.from('profiles').select('*').eq('id', refreshResult.data.session.user.id).single(),
              5000
            );
            if (retry?.data?.approved) {
              const meData = buildMe(refreshResult.data.session.user, retry.data);
              setMe(meData);
              registerSession(meData).catch(() => {});
              return true;
            }
          }
        }
        return false;
      }

      if (!profile?.approved) {
        console.warn('[auth] Not approved');
        return false;
      }

      const meData = buildMe(session.user, profile);
      setMe(meData);
      registerSession(meData).catch(() => {});
      // Log login event (fire-and-forget)
      return true;
    } catch (e) {
      console.error('[auth] applySession threw:', e);
      return false;
    }
  };

  useEffect(() => {
    // Absolute hard cap — no matter what, clear Laden… after 6s
    const hardTimeout = setTimeout(() => {
      console.warn('[auth] Hard timeout hit — forcing authChecked');
      markChecked();
    }, 6000);

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth]', event, session?.user?.email ?? 'no user');

      if (event === 'INITIAL_SESSION') {
        if (session) {
          await applySession(session);
        }
        clearTimeout(hardTimeout);
        markChecked();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await applySession(session);
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        clearTimeout(hardTimeout);
        markChecked();
        return;
      }

      if (event === 'SIGNED_OUT') {
        setMe(null);
        clearTimeout(hardTimeout);
        markChecked();
        return;
      }
    });

    return () => {
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async (meData) => {
    // Log logout before clearing session
    if (meData?.userId) {
    }
    // Clear lastSeen so the user disappears from Gebruikers panel immediately
    if (meData?.userId) {
      try {
        const { data } = await sb.from('app_state').select('sessions').eq('id', 1).single();
        if (data?.sessions?.[meData.userId]) {
          const sessions = { ...data.sessions };
          sessions[meData.userId] = { ...sessions[meData.userId], lastSeen: 0 };
          await sb.from('app_state').update({ sessions }).eq('id', 1);
        }
      } catch {}
    }
    try { await sb.auth.signOut(); } catch {}
    setMe(null);
  };

  const toggleLeader = () => setMe((p) => ({ ...p, isLeader: !p.isLeader }));

  return { me, setMe, authChecked, signOut: () => signOut(me), toggleLeader };
}

function buildMe(user, profile) {
  return {
    userId: user.id,
    name: profile.name,
    isLeader: profile.is_leader,
    team: profile.team || null,
    email: user.email,
  };
}
