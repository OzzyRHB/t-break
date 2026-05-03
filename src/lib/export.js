import { sb } from './supabase';
import { TYPES } from './constants';
import { todayStr } from './helpers';

const EXPECTED_SEC = {
  brb:   180,
  short: 900,
  lunch: 1800,
};

function msToHmmss(ms) {
  if (!ms || ms <= 0) return '';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Column headers ────────────────────────────────────────────────
export const CSV_HEADERS = [
  'Team',
  'Naam',
  'Logtekst',
  'Type',
  'Eindstatus',
  'Pauze Tijd (H:MM:SS)',
  'Overtijd (H:MM:SS)',
  'Start',
  'Einde',
  'Log Tijd',
];

// ── Admin action label map ────────────────────────────────────────
const ADMIN_ACTION_LABELS = {
  'ticket-add':       'Ticket toegevoegd',
  'ticket-remove':    'Ticket verwijderd',
  'extra-break':      'Extra pauze toegekend',
  'remove-extra':     'Extra pauze verwijderd',
  'leader-assign':    'Leider aangesteld',
  'leader-unassign':  'Leider verwijderd',
  'team-assign':      'Teamwissel (admin)',
  'team-switched':    'Teamwissel (zelf)',
  'team-request':     'Teamwissel aangevraagd',
  'set-default':      'Standaard config opgeslagen',
  'load-default':     'Standaard config geladen',
  'reset':            'Alles gereset',
  'clear-log':        'Logboek gewist',
};

function adminLogtekst(r) {
  // Super-ticket assignment — already a full sentence
  if (r.action && r.action.startsWith('heeft een')) return r.action;

  const d = r.action_data || {};
  const base = ADMIN_ACTION_LABELS[r.action] || r.action || 'Admin actie';

  if ((r.action === 'ticket-add' || r.action === 'ticket-remove') &&
      d.oldVal != null && d.newVal != null) {
    return `${base} · ${d.oldVal} → ${d.newVal}`;
  }
  if (['leader-assign','leader-unassign','extra-break','remove-extra',
       'team-assign','team-switched','team-request'].includes(r.action) && d.userName) {
    const extra = (d.oldVal != null && d.newVal != null) ? ` · ${d.oldVal} → ${d.newVal}` : '';
    return `${base} · ${d.userName}${extra}`;
  }
  return base;
}

function adminLogtekstFromEntry(e) {
  // Super-ticket assignment
  if (e.action && e.action.startsWith('heeft een')) return e.action;

  const base = ADMIN_ACTION_LABELS[e.action] || e.action || 'Admin actie';

  if ((e.action === 'ticket-add' || e.action === 'ticket-remove') &&
      e.oldVal != null && e.newVal != null) {
    return `${base} · ${e.oldVal} → ${e.newVal}`;
  }
  if (['leader-assign','leader-unassign','extra-break','remove-extra',
       'team-assign','team-switched','team-request'].includes(e.action) && e.userName) {
    const extra = (e.oldVal != null && e.newVal != null) ? ` · ${e.oldVal} → ${e.newVal}` : '';
    return `${base} · ${e.userName}${extra}`;
  }
  return base;
}

async function buildRows(data, teams = []) {
  const getLabel = (id) => teams.find(t => t.id === id)?.label || id || '';

  // Resolve team for rows that don't carry it
  const userIds = [...new Set(data.filter(r => !r.team && r.user_id).map(r => r.user_id))];
  const profileTeams = {};
  if (userIds.length > 0) {
    const { data: profiles } = await sb.from('profiles').select('id, team').in('id', userIds);
    profiles?.forEach(p => { profileTeams[p.id] = p.team; });
  }

  const fmtDt = (ts) => ts
    ? new Date(ts).toLocaleString('nl-NL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  const fmtTime = (ts) => ts
    ? new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    : '';

  return data.map(r => {
    // ── Admin row ──────────────────────────────────────────────────
    if (r.kind === 'admin') {
      const teamId = r.action_data?.team || '';
      return [
        getLabel(teamId),                   // Team
        r.admin_name || '',                 // Naam (who performed the action)
        adminLogtekst(r),                   // Logtekst
        'ADMIN',                            // Type
        '',                                 // Eindstatus
        '',                                 // Pauze Tijd
        '',                                 // Overtijd
        fmtTime(r.started_at),             // Start (= moment of action)
        '',                                 // Einde
        fmtDt(r.started_at),              // Log Tijd
      ];
    }

    // ── Break row ──────────────────────────────────────────────────
    if (!r.break_type || !['brb','short','lunch'].includes(r.break_type)) return null;

    const durMs   = r.duration_ms || (r.ended_at && r.started_at
      ? new Date(r.ended_at) - new Date(r.started_at)
      : 0);
    const expMs   = (EXPECTED_SEC[r.break_type] || 0) * 1000;
    const overMs  = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
    const isLate  = overMs > 0;
    const teamId  = r.team || profileTeams[r.user_id] || '';

    const endReasonMap = {
      early:          'VROEG',
      timer:          'TIMER',
      forfeit:        'VERLOPEN',
      'leader-ended': 'ADMIN',
    };
    const eindstatus = isLate
      ? 'LAAT'
      : (endReasonMap[r.end_reason] || r.end_reason || '');

    const logtekstMap = {
      brb:   'is even BRB gegaan...',
      short: 'heeft korte pauze genomen',
      lunch: 'heeft lunchpauze genomen',
    };
    const logtekst = logtekstMap[r.break_type] || '';
    const pauzeMin = durMs > 0 ? msToHmmss(durMs) : '';
    const logTs = r.ended_at || r.started_at;

    return [
      getLabel(teamId),
      r.user_name || '',
      logtekst,
      (r.break_type || '').toUpperCase(),
      eindstatus,
      pauzeMin,
      isLate ? msToHmmss(overMs) : '',
      fmtTime(r.started_at),
      fmtTime(r.ended_at),
      fmtDt(logTs),
    ];
  }).filter(Boolean);
}

// ── CSV serialiser ────────────────────────────────────────────────
function toCsv(rows) {
  const all = [CSV_HEADERS, ...rows];
  return '\uFEFF' + all.map(r =>
    r.map(c => {
      if (typeof c === 'number') return c;
      return `"${String(c ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
}

function download(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Shared fetch ──────────────────────────────────────────────────
async function fetchLogs(filters, notify) {
  let q = sb.from('logs').select('*');
  if (filters.userId)   q = q.eq('user_id', filters.userId);
  if (filters.userName && !filters.userId) q = q.eq('user_name', filters.userName);
  if (filters.from)     q = q.gte('log_date', filters.from);
  if (filters.to)       q = q.lte('log_date', filters.to);
  q = q.order('log_date').order('started_at');

  let { data } = await q;

  // Fallback: try by name if ID query returned nothing
  if (!data?.length && filters.userId && filters.userName) {
    let q2 = sb.from('logs').select('*').eq('user_name', filters.userName);
    if (filters.from) q2 = q2.gte('log_date', filters.from);
    if (filters.to)   q2 = q2.lte('log_date', filters.to);
    q2 = q2.order('log_date').order('started_at');
    const { data: d2 } = await q2;
    data = d2;
  }

  if (!data?.length) { notify?.('Geen logs gevonden', 'warn'); return null; }
  return data;
}

// ── Public export functions ───────────────────────────────────────

/** All logs for one employee */
export async function exportUserLogs(userId, userName, teams = [], notify) {
  const data = await fetchLogs({ userId, userName }, notify);
  if (!data) return;
  const slug = userName.trim().replace(/\s+/g, '-');
  download(toCsv(await buildRows(data, teams)), `tbreak-${slug}-alle-logs.csv`);
}

/** Date-range logs for one employee */
export async function exportUserLogsRange(userId, userName, from, to, teams = [], notify) {
  const data = await fetchLogs({ userId, userName, from, to }, notify);
  if (!data) return;
  const slug = userName.trim().replace(/\s+/g, '-');
  download(toCsv(await buildRows(data, teams)), `tbreak-${slug}-${from}--${to}.csv`);
}

/** All logs for a single day */
export async function exportDayLogs(date, teams = [], notify) {
  const data = await fetchLogs({ from: date, to: date }, notify);
  if (!data) return;
  download(toCsv(await buildRows(data, teams)), `tbreak-log-${date}.csv`);
}

/** All logs across a date range */
export async function exportRangeLogs(from, to, teams = [], notify) {
  const data = await fetchLogs({ from, to }, notify);
  if (!data) return;
  download(toCsv(await buildRows(data, teams)), `tbreak-logs-${from}--${to}.csv`);
}

/** Export directly from state.log (live in-memory log, not yet in DB archive) */
export function exportStateLogs(log = [], teams = [], notify) {
  const getLabel = (id) => teams.find(t => t.id === id)?.label || id || '';

  const fmtTime = (ts) => ts
    ? new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    : '';
  const fmtDt = (ts) => ts
    ? new Date(ts).toLocaleString('nl-NL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  const logtekstMap = {
    brb: 'is even BRB gegaan...', short: 'heeft korte pauze genomen', lunch: 'heeft lunchpauze genomen',
  };
  const endReasonMap = { early: 'VROEG', timer: 'TIMER', forfeit: 'VERLOPEN', 'leader-ended': 'ADMIN' };

  const rows = (log || []).map(e => {
    // ── Admin entry ──────────────────────────────────────────────
    if (e.kind === 'admin') {
      return [
        getLabel(e.team || ''),
        e.adminName || '',
        adminLogtekstFromEntry(e),
        'ADMIN',
        '',
        '',
        '',
        fmtTime(e.at),
        '',
        fmtDt(e.at),
      ];
    }

    // ── Break entry ──────────────────────────────────────────────
    if (!e.type || !['brb','short','lunch'].includes(e.type)) return null;

    const durMs  = (e.startedAt && e.endedAt) ? e.endedAt - e.startedAt : 0;
    const expMs  = (EXPECTED_SEC[e.type] || 0) * 1000;
    const overMs = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
    const isLate = overMs > 0;
    const eindstatus = isLate ? 'LAAT' : (endReasonMap[e.endReason] || e.endReason || '');
    return [
      getLabel(e.team || ''),
      e.userName || '',
      logtekstMap[e.type] || '',
      (e.type || '').toUpperCase(),
      eindstatus,
      durMs > 0 ? msToHmmss(durMs) : '',
      isLate ? msToHmmss(overMs) : '',
      fmtTime(e.startedAt),
      fmtTime(e.endedAt),
      fmtDt(e.endedAt || e.startedAt),
    ];
  }).filter(Boolean);

  if (!rows.length) { notify?.('Geen logs gevonden in huidig logboek', 'warn'); return; }
  const date = new Date().toISOString().slice(0, 10);
  download(toCsv(rows), `tbreak-log-live-${date}.csv`);
}
