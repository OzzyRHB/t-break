import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import {
  blankState,
  cleanup,
  loadShared,
  saveShared,
  insertLog,
} from '../lib/state';
import { TYPES, TEAM_LABELS } from '../lib/constants';
import { todayStr, uid, eq } from '../lib/helpers';

export function useAppState(me, setMe, notify) {
  const [state, setState] = useState(blankState());
  const [, setTick] = useState(0);
  const actionQueue = useRef(Promise.resolve());

  // Realtime + initial sync + polling fallback
  useEffect(() => {
    if (!me) return;
    let mounted = true;

    const doSync = async (incoming) => {
      if (!mounted) return;
      const raw = incoming || (await loadShared());

      // Check if user had an active offer before cleanup
      const myTeamRaw = me.team ? raw.teams[me.team] : null;
      const hadOffer = myTeamRaw
        ? Object.keys(TYPES).some(type =>
            myTeamRaw.queues[type]?.some(q => q.userId === me.userId && q.offeredAt)
          )
        : false;

      const cleaned = cleanup(raw);

      // If user had an offer but it's gone after cleanup → notify them it expired
      const myTeamCleaned = me.team ? cleaned.teams[me.team] : null;
      const stillHasOffer = myTeamCleaned
        ? Object.keys(TYPES).some(type =>
            myTeamCleaned.queues[type]?.some(q => q.userId === me.userId && q.offeredAt)
          )
        : false;
      if (hadOffer && !stillHasOffer && mounted) {
        // Check they didn't just claim it (would be in activeBreaks)
        const nowOnBreak = myTeamCleaned?.activeBreaks?.some(b => b.userId === me.userId);
        if (!nowOnBreak) {
          notify('Je ticket-aanbieding is verlopen — je bent uit de wachtrij verwijderd', 'warn');
        }
      }

      if (!eq(cleaned, raw)) {
        try {
          await saveShared(cleaned);
        } catch (e) {
          console.error('sync save error', e);
        }
      }
      if (mounted) {
        setState(cleaned);
        const sr = cleaned.sessions?.[me.userId];
        if (sr && (sr.isLeader !== me.isLeader || sr.team !== me.team)) {
          const updated = {
            ...me,
            isLeader: sr.isLeader ?? me.isLeader,
            team: sr.team ?? me.team,
          };
          setMe(updated);
          await sb
            .from('profiles')
            .update({ is_leader: updated.isLeader, team: updated.team })
            .eq('id', me.userId);
        }
      }
    };

    doSync();

    const channel = sb
      .channel('app_state_rt')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.1' },
        () => {
          if (!mounted) return;
          loadShared().then((raw) => doSync(raw));
        }
      )
      .subscribe();

    // 3s polling fallback in case Realtime isn't enabled on the table
    const poll = setInterval(() => {
      if (mounted) doSync();
    }, 3000);

    // 30s heartbeat to keep lastSeen fresh
    const heartbeat = setInterval(async () => {
      if (!me) return;
      try {
        const { data } = await sb.from('app_state').select('sessions').eq('id', 1).single();
        const sessions = { ...(data?.sessions || {}) };
        if (sessions[me.userId]) {
          sessions[me.userId].lastSeen = Date.now();
          await sb.from('app_state').update({ sessions }).eq('id', 1);
        }
      } catch {}
    }, 30000);

    // 1s tick for countdowns
    const tick = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      mounted = false;
      channel.unsubscribe();
      clearInterval(tick);
      clearInterval(heartbeat);
      clearInterval(poll);
    };
  }, [me?.userId]);

  // Queue-based act(): serialize all mutations, never deadlock
  const act = (mutator) => {
    const result = actionQueue.current.then(async () => {
      try {
        const fresh = await loadShared();
        const cleaned = cleanup(fresh);
        const proposed = await Promise.resolve(mutator(cleaned));
        if (!proposed) return;
        const next = cleanup(proposed);
        await saveShared(next);
        setState(next);
      } catch (e) {
        console.error('act error:', e);
        notify('Er ging iets mis, probeer opnieuw', 'warn');
      }
    });
    actionQueue.current = result.catch(() => {});
    return result;
  };

  // ---------- Employee actions ----------
  const takeTicket = (type) =>
    act((s) => {
      if (!me.team) {
        notify('Je bent niet aan een team toegewezen', 'warn');
        return null;
      }
      const t = s.teams[me.team];
      if (type !== 'brb' && t.activeBreaks.some((b) => b.userId === me.userId)) {
        notify('Je bent al op pauze', 'warn');
        return null;
      }
      if (
        type !== 'brb' &&
        Object.values(t.queues).some((q) => q.some((e) => e.userId === me.userId))
      ) {
        notify('Al in wachtrij', 'warn');
        return null;
      }
      const usage = t.usage[me.userId] || { date: todayStr(), short: 0, lunch: 0 };
      const { dailyLimKey, dailyKey } = TYPES[type];
      const extra = type === 'short' ? t.extraBreaks[me.userId] || 0 : 0;
      if (dailyLimKey && usage[dailyKey] >= t.config[dailyLimKey] + extra) {
        notify(`Daglimiet ${TYPES[type].label} bereikt`, 'warn');
        return null;
      }
      if (t.activeBreaks.filter((b) => b.type === type).length >= t.config[TYPES[type].poolKey]) {
        notify('Geen tickets meer beschikbaar', 'warn');
        return null;
      }
      t.activeBreaks.push({
        id: uid(),
        userId: me.userId,
        userName: me.name,
        type,
        startedAt: Date.now(),
        fromQueue: false,
        team: me.team,
      });
      if (dailyKey) {
        if (!t.usage[me.userId]) t.usage[me.userId] = { date: todayStr(), short: 0, lunch: 0 };
        t.usage[me.userId][dailyKey] += 1;
      }
      notify(`${TYPES[type].label} gestart`, 'ok');
      return s;
    });

  const joinQueue = (type) =>
    act((s) => {
      if (!me.team) {
        notify('Je bent niet aan een team toegewezen', 'warn');
        return null;
      }
      const t = s.teams[me.team];
      if (t.activeBreaks.some((b) => b.userId === me.userId)) {
        notify('Je bent op pauze', 'warn');
        return null;
      }
      if (Object.values(t.queues).some((q) => q.some((e) => e.userId === me.userId))) {
        notify('Al in wachtrij', 'warn');
        return null;
      }
      const usage = t.usage[me.userId] || { date: todayStr(), short: 0, lunch: 0 };
      const { dailyLimKey, dailyKey } = TYPES[type];
      const extra = type === 'short' ? t.extraBreaks[me.userId] || 0 : 0;
      if (dailyLimKey && usage[dailyKey] >= t.config[dailyLimKey] + extra) {
        notify(`Daglimiet ${TYPES[type].label} bereikt`, 'warn');
        return null;
      }
      t.queues[type].push({ userId: me.userId, userName: me.name, joinedAt: Date.now() });
      notify(`In wachtrij voor ${TYPES[type].label}`, 'ok');
      return s;
    });

  const leaveQueue = (type, userId = me.userId, team = me.team) =>
    act((s) => {
      if (!team) return null;
      s.teams[team].queues[type] = s.teams[team].queues[type].filter((q) => q.userId !== userId);
      return s;
    });

  const endMyBreak = () =>
    act(async (s) => {
      if (!me.team) return null;
      const t = s.teams[me.team];
      const b = t.activeBreaks.find((x) => x.userId === me.userId);
      if (!b) return null;
      const endedAt = Date.now();
      const dur = t.config[TYPES[b.type].durKey];
      const wasOverrun = endedAt > b.startedAt + dur * 1000;
      t.activeBreaks = t.activeBreaks.filter((x) => x.id !== b.id);
      const entry = { ...b, endedAt, endReason: wasOverrun ? 'timer' : 'early', team: me.team };
      s.log.unshift(entry);
      await insertLog(entry);
      if (!s.totalTime[b.userId])
        s.totalTime[b.userId] = { name: b.userName, brb: 0, short: 0, lunch: 0 };
      s.totalTime[b.userId][b.type] += endedAt - b.startedAt;
      s.totalTime[b.userId].name = b.userName;
      // Mark user as having had an overrun today (resets on day rollover)
      if (wasOverrun) {
        if (!s.overrunToday) s.overrunToday = {};
        s.overrunToday[b.userId] = true;
      }
      notify(wasOverrun ? 'Welkom terug — je was over tijd' : 'Welkom terug', wasOverrun ? 'warn' : 'ok');
      return s;
    });

  const claimOffer = (type) =>
    act(async (s) => {
      if (!me.team) return null;
      const t = s.teams[me.team];
      if (t.activeBreaks.some((b) => b.userId === me.userId)) {
        notify('Je bent al op pauze', 'warn');
        return null;
      }
      const entry = t.queues[type].find((q) => q.userId === me.userId);
      if (!entry?.offeredAt) {
        notify('Geen ticket om te claimen', 'warn');
        return null;
      }
      // Hard capacity check — overrun breaks still occupy slots
      const activeCnt = t.activeBreaks.filter((b) => b.type === type).length;
      if (activeCnt >= t.config[TYPES[type].poolKey]) {
        // Slot no longer available (someone claimed it first, or overrun occupies it)
        // Remove the stale offer so the UI updates
        t.queues[type] = t.queues[type].map((q) =>
          q.userId === me.userId ? { ...q, offeredAt: undefined } : q
        );
        notify('Ticket niet meer beschikbaar, je staat nog in de wachtrij', 'warn');
        return s;
      }
      const { dailyKey, dailyLimKey } = TYPES[type];
      if (dailyKey && dailyLimKey) {
        const usage = t.usage[me.userId] || { date: todayStr(), short: 0, lunch: 0 };
        const extra = type === 'short' ? t.extraBreaks[me.userId] || 0 : 0;
        if (usage[dailyKey] >= t.config[dailyLimKey] + extra) {
          notify(`Daglimiet ${TYPES[type].label} bereikt`, 'warn');
          return null;
        }
      }
      t.queues[type] = t.queues[type].filter((q) => q.userId !== me.userId);
      t.activeBreaks.push({
        id: uid(),
        userId: me.userId,
        userName: me.name,
        type,
        startedAt: Date.now(),
        fromQueue: true,
        team: me.team,
      });
      if (dailyKey) {
        if (!t.usage[me.userId]) t.usage[me.userId] = { date: todayStr(), short: 0, lunch: 0 };
        t.usage[me.userId][dailyKey] += 1;
      }
      notify(`${TYPES[type].label} gestart`, 'ok');
      return s;
    });

  const declineOffer = (type) =>
    act((s) => {
      if (!me.team) return null;
      s.teams[me.team].queues[type] = s.teams[me.team].queues[type].filter(
        (q) => q.userId !== me.userId
      );
      notify('Aanbieding geweigerd', 'warn');
      return s;
    });

  // ---------- Leader actions ----------
  const endBreakFor = (breakId, team) =>
    act(async (s) => {
      const t = s.teams[team];
      const b = t.activeBreaks.find((x) => x.id === breakId);
      if (!b) return null;
      const endedAt = Date.now();
      t.activeBreaks = t.activeBreaks.filter((x) => x.id !== breakId);
      const entry = { ...b, endedAt, endReason: 'leader-ended', team };
      s.log.unshift(entry);
      await insertLog(entry);
      if (!s.totalTime[b.userId])
        s.totalTime[b.userId] = { name: b.userName, brb: 0, short: 0, lunch: 0 };
      s.totalTime[b.userId][b.type] += endedAt - b.startedAt;
      return s;
    });

  const updateConfig = (team, patch) =>
    act(async (s) => {
      const oldCfg = { ...s.teams[team].config };
      s.teams[team].config = { ...s.teams[team].config, ...patch };
      for (const key of Object.keys(patch)) {
        const type = Object.keys(TYPES).find((tp) => TYPES[tp].poolKey === key);
        if (type && patch[key] !== oldCfg[key]) {
          const entry = {
            kind: 'admin',
            action: patch[key] > oldCfg[key] ? 'ticket-add' : 'ticket-remove',
            type,
            team,
            oldVal: oldCfg[key],
            newVal: patch[key],
            adminName: me.name,
            at: Date.now(),
          };
          s.log.unshift(entry);
          await insertLog(entry);
        }
      }
      s.log = s.log.slice(0, 100);
      return s;
    });

  const setDefaultConfig = (team) =>
    act(async (s) => {
      if (!s.defaultConfigs) s.defaultConfigs = {};
      s.defaultConfigs[team] = { ...s.teams[team].config };
      const entry = {
        kind: 'admin',
        action: 'set-default',
        team,
        adminName: me.name,
        at: Date.now(),
      };
      s.log.unshift(entry);
      await insertLog(entry);
      s.log = s.log.slice(0, 100);
      return s;
    });

  const loadDefaultConfig = (team) =>
    act(async (s) => {
      const def = s.defaultConfigs?.[team];
      if (!def) {
        notify('Nog geen standaard opgeslagen', 'warn');
        return null;
      }
      s.teams[team].config = { ...s.teams[team].config, ...def };
      const entry = {
        kind: 'admin',
        action: 'load-default',
        team,
        adminName: me.name,
        at: Date.now(),
      };
      s.log.unshift(entry);
      await insertLog(entry);
      s.log = s.log.slice(0, 100);
      return s;
    });

  const grantExtraBreak = (team, userId, userName) =>
    act(async (s) => {
      const t = s.teams[team];
      t.extraBreaks[userId] = (t.extraBreaks[userId] || 0) + 1;
      const entry = {
        kind: 'admin',
        action: 'extra-break',
        team,
        userId,
        userName,
        adminName: me.name,
        at: Date.now(),
      };
      s.log.unshift(entry);
      await insertLog(entry);
      s.log = s.log.slice(0, 100);
      return s;
    });

  const removeExtraBreak = (team, userId, userName) =>
    act(async (s) => {
      const t = s.teams[team];
      if ((t.extraBreaks[userId] || 0) <= 0) {
        notify('Geen extra pauzes om te verwijderen', 'warn');
        return null;
      }
      t.extraBreaks[userId] = Math.max(0, (t.extraBreaks[userId] || 0) - 1);
      const entry = {
        kind: 'admin',
        action: 'remove-extra',
        team,
        userId,
        userName,
        adminName: me.name,
        at: Date.now(),
      };
      s.log.unshift(entry);
      await insertLog(entry);
      s.log = s.log.slice(0, 100);
      return s;
    });

  const assignLeader = (userId, userName, makeLeader) =>
    act(async (s) => {
      if (!s.sessions) s.sessions = {};
      if (s.sessions[userId]) s.sessions[userId].isLeader = makeLeader;
      else s.sessions[userId] = { name: userName, isLeader: makeLeader, lastSeen: Date.now() };
      await sb.from('profiles').update({ is_leader: makeLeader }).eq('id', userId);
      const entry = {
        kind: 'admin',
        action: makeLeader ? 'leader-assign' : 'leader-unassign',
        userId,
        userName,
        adminName: me.name,
        at: Date.now(),
      };
      s.log.unshift(entry);
      await insertLog(entry);
      s.log = s.log.slice(0, 100);
      return s;
    });

  const assignTeam = async (userId, userName, toTeam) => {
    try {
      await sb.from('profiles').update({ team: toTeam }).eq('id', userId);
      await act(async (s) => {
        if (!s.sessions[userId])
          s.sessions[userId] = { name: userName, isLeader: false, lastSeen: Date.now() };
        s.sessions[userId].team = toTeam;
        const entry = {
          kind: 'admin',
          action: 'team-assign',
          userId,
          userName,
          team: toTeam,
          adminName: me.name,
          at: Date.now(),
        };
        s.log.unshift(entry);
        await insertLog(entry);
        s.log = s.log.slice(0, 100);
        return s;
      });
      notify(`${userName} verplaatst naar ${TEAM_LABELS[toTeam]}`, 'ok');
    } catch (e) {
      console.error('assignTeam', e);
      notify('Er ging iets mis', 'warn');
    }
  };

  const resetAll = () =>
    act(async (s) => {
      const fresh = blankState();
      const entry = { kind: 'admin', action: 'reset', adminName: me.name, at: Date.now() };
      fresh.log.unshift(entry);
      await insertLog(entry);
      return fresh;
    });

  const clearLog = () =>
    act(async (s) => {
      const entry = { kind: 'admin', action: 'clear-log', adminName: me.name, at: Date.now() };
      await insertLog(entry);
      s.log = [entry]; // wipe today's in-memory log, keep only this marker
      return s;
    });

  // Employee self team-switch (once per day, or creates request)
  const requestTeamSwitch = async (toTeam) => {
    if (!me) return;
    try {
      const { data: profile } = await sb
        .from('profiles')
        .select('team_changed_date')
        .eq('id', me.userId)
        .single();
      if (profile?.team_changed_date === todayStr()) {
        const { error: reqErr } = await sb.from('team_change_requests').insert({
          user_id: me.userId,
          user_name: me.name,
          from_team: me.team,
          to_team: toTeam,
        });
        if (reqErr) {
          notify('Fout bij aanvragen', 'warn');
          return;
        }
        await act(async (s) => {
          const entry = {
            kind: 'admin',
            action: 'team-request',
            userId: me.userId,
            userName: me.name,
            oldVal: me.team,
            newVal: toTeam,
            adminName: me.name,
            at: Date.now(),
          };
          s.log.unshift(entry);
          await insertLog(entry);
          s.log = s.log.slice(0, 100);
          return s;
        });
        notify('Teamwijzigingsverzoek ingediend. De leider krijgt een melding.', 'ok');
      } else {
        await sb
          .from('profiles')
          .update({ team: toTeam, team_changed_date: todayStr() })
          .eq('id', me.userId);
        setMe((p) => ({ ...p, team: toTeam }));
        await act((s) => {
          if (s.sessions[me.userId]) s.sessions[me.userId].team = toTeam;
          return s;
        });
        notify(`Je bent nu in team ${TEAM_LABELS[toTeam]}`, 'ok');
      }
    } catch (e) {
      console.error('requestTeamSwitch', e);
      notify('Er ging iets mis', 'warn');
    }
  };

  return {
    state,
    act,
    takeTicket,
    joinQueue,
    leaveQueue,
    endMyBreak,
    endBreakFor,
    claimOffer,
    declineOffer,
    updateConfig,
    setDefaultConfig,
    loadDefaultConfig,
    grantExtraBreak,
    removeExtraBreak,
    assignLeader,
    assignTeam,
    resetAll,
    clearLog,
    requestTeamSwitch,
  };
}
