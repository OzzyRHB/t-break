import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { registerSession } from '../lib/state';

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
      const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.warn('Profile query error:', error.code, error.message);
        // PGRST116 = not found; anything else could be a permissions/token issue
        if (error.code !== 'PGRST116') {
          // Try refreshing the session token and retrying once
          const { data: refreshed } = await sb.auth.refreshSession();
          if (refreshed?.session) {
            const { data: p2 } = await sb
              .from('profiles')
              .select('*')
              .eq('id', refreshed.session.user.id)
              .single();
            if (p2?.approved) {
              const meData = buildMe(refreshed.session.user, p2);
              setMe(meData);
              registerSession(meData).catch(() => {});
              return true;
            }
          }
        }
        return false;
      }

      if (!profile?.approved) {
        console.warn('Profile not approved for', session.user.id);
        return false;
      }

      const meData = buildMe(session.user, profile);
      setMe(meData);
      registerSession(meData).catch(() => {});
      return true;
    } catch (e) {
      console.error('applySession error:', e);
      return false;
    }
  };

  useEffect(() => {
    // Hard cap — never show Laden... for more than 8s
    const hardTimeout = setTimeout(markChecked, 8000);

    (async () => {
      try {
        // First try to get the current session
        const { data, error } = await sb.auth.getSession();

        if (error) {
          console.warn('getSession error:', error.message);
          markChecked();
          return;
        }

        if (data?.session) {
          await applySession(data.session);
          // Don't sign out if applySession fails — could be transient.
          // Just let the user see the login screen.
        }
      } catch (e) {
        console.error('restore error:', e);
      } finally {
        clearTimeout(hardTimeout);
        markChecked();
      }
    })();

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      console.log('auth event:', event);

      if (event === 'SIGNED_OUT') {
        setMe(null);
        markChecked();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session) {
          await applySession(session);
        }
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        markChecked();
      }

      if (event === 'INITIAL_SESSION') {
        // Supabase v2 fires this on page load with the stored session
        if (session) {
          await applySession(session);
        }
        markChecked();
      }
    });

    return () => {
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try { await sb.auth.signOut(); } catch {}
    setMe(null);
  };

  const toggleLeader = () => setMe((p) => ({ ...p, isLeader: !p.isLeader }));

  return { me, setMe, authChecked, signOut, toggleLeader };
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
