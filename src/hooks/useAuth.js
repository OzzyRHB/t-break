import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { registerSession } from '../lib/state';

export function useAuth() {
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const setMeRef = useRef(setMe);

  useEffect(() => {
    setMeRef.current = setMe;
  }, [setMe]);

  // Initial session restore
  useEffect(() => {
    const timeout = setTimeout(() => setAuthChecked(true), 8000);
    const tryRestore = async () => {
      clearTimeout(timeout);
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (session?.user) {
          const { data: profile } = await sb
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (profile?.approved) {
            const meData = {
              userId: session.user.id,
              name: profile.name,
              isLeader: profile.is_leader,
              team: profile.team || null,
              email: session.user.email,
            };
            setMe(meData);
            registerSession(meData);
            setAuthChecked(true);
            return;
          }
        }
        if (window.location.hash && window.location.hash.includes('access_token')) {
          // Wait for onAuthStateChange to process it
          setTimeout(() => setAuthChecked(true), 3000);
          return;
        }
      } catch (e) {
        console.error('restore error', e);
      }
      setAuthChecked(true);
    };
    tryRestore();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setMe(null);
        setAuthChecked(true);
        return;
      }
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.user
      ) {
        try {
          const { data: profile } = await sb
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (profile?.approved) {
            const meData = {
              userId: session.user.id,
              name: profile.name,
              isLeader: profile.is_leader,
              team: profile.team || null,
              email: session.user.email,
            };
            setMe(meData);
            registerSession(meData);
            if (window.location.hash.includes('access_token')) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        } catch (e) {
          console.error('auth change', e);
        }
        setAuthChecked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await sb.auth.signOut();
    setMe(null);
  };

  const toggleLeader = () => setMe((p) => ({ ...p, isLeader: !p.isLeader }));

  return { me, setMe, authChecked, signOut, toggleLeader };
}
