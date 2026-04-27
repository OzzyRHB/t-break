import { sb } from './supabase';
import { TEAMS as DEFAULT_TEAMS, TYPES, DEFAULT_TEAM_CONFIG, CLAIM_WINDOW_SEC } from './constants';
import { todayStr } from './helpers';

// ---------- state shape helpers ----------
export function blankTeam(cfg) {
  return {
    config: { ...DEFAULT_TEAM_CONFIG, ...(cfg || {}) },
    activeBreaks: [],
    queues: { brb: [], short: [], lunch: [] },
    usage: {},
    extraBreaks: {},
  };
}

export function blankState() {
  return {
    teams: {
      klantenservice: blankTeam(),
      commercieel: blankTeam(),
      freedom: blankTeam(),
    },
    sessions: {},
    totalTime: {},
    log: [],
    defaultConfigs: {},
    overrunToday: {},
    _lastDate: todayStr(),
  };
}

// ---------- Supabase load/save ----------
export async function loadShared() {
  try {
    const { data, error } = await sb.from('app_state').select('*').eq('id', 1).single();
    if (error || !data) return blankState();
    const state = blankState();
    state._lastDate = data.last_date || todayStr();
    state.log = data.log || [];
    state.sessions = data.sessions || {};
    state.totalTime = data.total_time || {};
    state.defaultConfigs = data.default_config || {};
    state.overrunToday = data.overrun_today || {};
    const rawConfig = data.config || {};
    const rawBreaks = data.active_breaks || {};
    const rawQueues = data.queues || {};
    const rawUsage = data.usage || {};
    const rawExtra = data.extra_breaks || {};
    // Use ALL team IDs found in saved data, not just hardcoded DEFAULT_TEAMS
    const allTeams = new Set([
      ...DEFAULT_TEAMS,
      ...Object.keys(rawConfig),
      ...Object.keys(rawBreaks),
      ...Object.keys(rawQueues),
    ]);
    for (const team of allTeams) {
      state.teams[team] = {
        config: { ...DEFAULT_TEAM_CONFIG, ...(rawConfig[team] || {}) },
        activeBreaks: rawBreaks[team] || [],
        queues: { brb: [], short: [], lunch: [], ...(rawQueues[team] || {}) },
        usage: rawUsage[team] || {},
        extraBreaks: rawExtra[team] || {},
      };
    }
    return state;
  } catch (e) {
    console.error('loadShared error', e);
    return blankState();
  }
}

export async function saveShared(s) {
  try {
    const config = {}, activeBreaks = {}, queues = {}, usage = {}, extraBreaks = {};
    // Save ALL teams in state, not just hardcoded DEFAULT_TEAMS
    for (const team of Object.keys(s.teams)) {
      const t = s.teams[team];
      if (!t) continue;
      config[team] = t.config;
      activeBreaks[team] = t.activeBreaks;
      queues[team] = t.queues;
      usage[team] = t.usage;
      extraBreaks[team] = t.extraBreaks;
    }
    await sb.from('app_state').upsert(
      {
        id: 1,
        config,
        active_breaks: activeBreaks,
        queues,
        usage,
        sessions: s.sessions || {},
        total_time: s.totalTime || {},
        extra_breaks: extraBreaks,
        default_config: s.defaultConfigs || {},
        log: (s.log || []).slice(0, 100),
        last_date: s._lastDate || todayStr(),
        overrun_today: s.overrunToday || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch (e) {
    console.error('saveShared error', e);
  }
}

// ---------- logs table ----------
export async function insertLog(entry) {
  try {
    const base = { kind: entry.kind || 'break', log_date: todayStr() };
    const row =
      entry.kind === 'admin'
        ? {
            ...base,
            admin_name: entry.adminName,
            action: entry.action,
            action_data: {
              userName: entry.userName,
              userId: entry.userId,
              oldVal: entry.oldVal,
              newVal: entry.newVal,
              team: entry.team,
            },
            started_at: new Date(entry.at).toISOString(),
          }
        : {
            ...base,
            user_id: entry.userId,
            user_name: entry.userName,
            team: entry.team || null,
            break_type: entry.type,
            started_at: new Date(entry.startedAt).toISOString(),
            ended_at: entry.endedAt ? new Date(entry.endedAt).toISOString() : null,
            end_reason: entry.endReason,
          };
    await sb.from('logs').insert(row);
  } catch (e) {
    console.error('insertLog', e);
  }
}

export async function loadArchiveDates() {
  try {
    const { data } = await sb
      .from('logs')
      .select('log_date')
      .order('log_date', { ascending: false });
    if (!data) return [];
    return [...new Set(data.map((r) => r.log_date))].filter((d) => d !== todayStr());
  } catch {
    return [];
  }
}

export async function loadArchive(date) {
  try {
    const { data } = await sb
      .from('logs')
      .select('*')
      .eq('log_date', date)
      .order('started_at', { ascending: false });
    return (data || []).map((r) =>
      r.kind === 'admin'
        ? {
            kind: 'admin',
            action: r.action,
            adminName: r.admin_name,
            userName: r.action_data?.userName,
            userId: r.action_data?.userId,
            oldVal: r.action_data?.oldVal,
            newVal: r.action_data?.newVal,
            team: r.action_data?.team,
            at: new Date(r.started_at).getTime(),
          }
        : {
            kind: 'break',
            userName: r.user_name,
            type: r.break_type,
            startedAt: new Date(r.started_at).getTime(),
            endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
            endReason: r.end_reason,
          }
    );
  } catch {
    return [];
  }
}

// ---------- session registration ----------
export async function registerSession(meData) {
  try {
    const { data } = await sb.from('app_state').select('sessions').eq('id', 1).single();
    const sessions = { ...(data?.sessions || {}) };
    sessions[meData.userId] = {
      name: meData.name,
      isLeader: meData.isLeader,
      team: meData.team,
      lastSeen: Date.now(),
    };
    await sb.from('app_state').update({ sessions }).eq('id', 1);
  } catch (e) {
    console.error('registerSession', e);
  }
}

// Ensure all dynamic team IDs have an entry in state.teams
// Call this whenever the teams list from Supabase updates
export function ensureTeamsInState(state, teamIds) {
  if (!teamIds?.length) return state;
  let changed = false;
  const s = state;
  for (const id of teamIds) {
    if (!s.teams[id]) {
      s.teams[id] = blankTeam();
      changed = true;
    }
  }
  return changed ? { ...s, teams: { ...s.teams } } : s;
}

// ---------- cleanup: per-team expiry + offer distribution ----------
export function cleanup(state) {
  const s = JSON.parse(JSON.stringify(state));
  const now = Date.now();
  if (!s.totalTime) s.totalTime = {};
  if (!s.defaultConfigs) s.defaultConfigs = {};
  if (!s._lastDate) s._lastDate = todayStr();

  // Day rollover
  if (s._lastDate !== todayStr()) {
    s.log = [];
    s._lastDate = todayStr();
    s.totalTime = {};
    s.overrunToday = {};
    for (const team of Object.keys(s.teams)) {
      s.teams[team].extraBreaks = {};
      s.teams[team].usage = {};
    }
  }

  for (const team of Object.keys(s.teams)) {
    const t = s.teams[team];
    if (!t) {
      s.teams[team] = blankTeam();
      continue;
    }
    if (!t.extraBreaks) t.extraBreaks = {};
    if (!t.usage) t.usage = {};

    // Stale usage reset
    for (const u of Object.keys(t.usage)) {
      if (t.usage[u].date !== todayStr()) {
        t.usage[u] = { date: todayStr(), short: 0, lunch: 0 };
      }
    }

    // Keep ALL active breaks — don't auto-end on timer expiry.
    t.activeBreaks = t.activeBreaks || [];

    // Process queues for each ticket type
    for (const type of Object.keys(TYPES)) { // per ticket type
      const cap = t.config[TYPES[type].poolKey];

      // Step 1: expire stale offers — claim window ran out, person didn't claim
      for (const q of t.queues[type]) {
        if (q.offeredAt && now > q.offeredAt + CLAIM_WINDOW_SEC * 1000) {
          // Forfeit — remove offer, leave them at the back of the queue
          // (remove from queue entirely; they'll have to re-join)
          q.offeredAt = null;
          q._expired = true;
        }
      }
      // Remove forfeited entries
      t.queues[type] = t.queues[type].filter(q => !q._expired);

      // Step 2: offer slots to next in line
      const activeCnt = t.activeBreaks.filter((b) => b.type === type).length;
      const offered = t.queues[type].filter((q) => q.offeredAt).length;
      let slots = Math.max(0, cap - activeCnt - offered);
      for (let i = 0; i < t.queues[type].length && slots > 0; i++) {
        if (!t.queues[type][i].offeredAt) {
          t.queues[type][i].offeredAt = now;
          slots--;
        }
      }
    }
  }

  s.log = s.log.slice(0, 100);
  return s;
}

// ---------- Global settings (naming convention, etc.) ----------
export async function loadGlobalSettings() {
  try {
    const { data } = await sb.from('app_state').select('global_settings').eq('id', 1).single();
    return data?.global_settings || {};
  } catch { return {}; }
}

export async function saveGlobalSettings(patch) {
  try {
    const { data } = await sb.from('app_state').select('global_settings').eq('id', 1).single();
    const current = data?.global_settings || {};
    await sb.from('app_state').update({ global_settings: { ...current, ...patch } }).eq('id', 1);
  } catch (e) { console.error('saveGlobalSettings error', e); }
}
