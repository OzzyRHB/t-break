import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { TEAM_LABELS } from '../lib/constants';
import { insertLog } from '../lib/state';

export function useAdminData(me, notify) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const prevPendingCountRef = useRef(null);
  const prevReqCountRef = useRef(null);

  useEffect(() => {
    if (!me?.isLeader) return;

    const fetchPending = async () => {
      const { data } = await sb.from('profiles').select('*').eq('approved', false);
      const fresh = data || [];
      if (
        prevPendingCountRef.current !== null &&
        fresh.length > prevPendingCountRef.current
      ) {
        const newest = fresh[fresh.length - 1];
        if (newest) notify(`Nieuwe account-aanvraag: ${newest.name}`, 'ok');
      }
      prevPendingCountRef.current = fresh.length;
      setPendingUsers(fresh);
    };

    const fetchRequests = async () => {
      const { data } = await sb
        .from('team_change_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at');
      const fresh = data || [];
      if (prevReqCountRef.current !== null && fresh.length > prevReqCountRef.current) {
        const newest = fresh[fresh.length - 1];
        if (newest) {
          notify(`Teamwijzigingsverzoek van ${newest.user_name}`, 'warn');
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('T-Break — Teamwijzigingsverzoek', {
                body: `${newest.user_name} wil naar ${TEAM_LABELS[newest.to_team]}`,
                tag: 'tbreak-team-req',
              });
            }
          } catch {}
        }
      }
      prevReqCountRef.current = fresh.length;
      setTeamRequests(fresh);
    };

    fetchPending();
    fetchRequests();

    const ch = sb
      .channel('admin_ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        fetchPending
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_change_requests' },
        fetchRequests
      )
      .subscribe();

    // 15s polling fallback
    const poll = setInterval(() => {
      fetchPending();
      fetchRequests();
    }, 15000);

    return () => {
      ch.unsubscribe();
      clearInterval(poll);
    };
  }, [me?.userId, me?.isLeader]);

  const approveUser = async (profileId, makeLeader = false, act) => {
    try {
      const { error } = await sb
        .from('profiles')
        .update({ approved: true, is_leader: makeLeader })
        .eq('id', profileId);
      if (error) {
        notify('Fout bij goedkeuren', 'warn');
        return;
      }
      setPendingUsers((prev) => prev.filter((p) => p.id !== profileId));
      const { data: p } = await sb.from('profiles').select('*').eq('id', profileId).single();
      if (p && act) {
        await act((s) => {
          s.sessions[profileId] = {
            name: p.name,
            isLeader: makeLeader,
            team: p.team || null,
            lastSeen: Date.now(),
          };
          return s;
        });
      }
      notify(`${p?.name || 'Gebruiker'} goedgekeurd`, 'ok');
    } catch (e) {
      console.error('approveUser', e);
      notify('Er ging iets mis', 'warn');
    }
  };

  const approveTeamRequest = async (req, act) => {
    await sb.from('profiles').update({ team: req.to_team }).eq('id', req.user_id);
    await sb.from('team_change_requests').update({ status: 'approved' }).eq('id', req.id);
    setTeamRequests((prev) => prev.filter((r) => r.id !== req.id));
    if (act) {
      await act(async (s) => {
        if (s.sessions[req.user_id]) s.sessions[req.user_id].team = req.to_team;
        const entry = {
          kind: 'admin',
          action: 'team-request-approved',
          userId: req.user_id,
          userName: req.user_name,
          oldVal: req.from_team,
          newVal: req.to_team,
          adminName: me.name,
          at: Date.now(),
        };
        s.log.unshift(entry);
        await insertLog(entry);
        s.log = s.log.slice(0, 100);
        return s;
      });
    }
    notify('Teamwijziging goedgekeurd', 'ok');
  };

  const denyTeamRequest = async (req, act) => {
    await sb.from('team_change_requests').update({ status: 'denied' }).eq('id', req.id);
    setTeamRequests((prev) => prev.filter((r) => r.id !== req.id));
    if (act) {
      await act(async (s) => {
        const entry = {
          kind: 'admin',
          action: 'team-request-denied',
          userId: req.user_id,
          userName: req.user_name,
          oldVal: req.from_team,
          newVal: req.to_team,
          adminName: me.name,
          at: Date.now(),
        };
        s.log.unshift(entry);
        await insertLog(entry);
        s.log = s.log.slice(0, 100);
        return s;
      });
    }
    notify('Teamwijziging afgewezen', 'warn');
  };

  return { pendingUsers, teamRequests, approveUser, approveTeamRequest, denyTeamRequest };
}
