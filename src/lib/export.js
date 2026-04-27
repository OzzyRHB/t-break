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
// Matches log view: Team · Naam · Logtekst · Type · Eindstatus · Overtijd (min) · Start · Einde · Pauze Tijd · Log Tijd
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

  return data
    .filter(r => r.kind !== 'admin' && r.break_type)
    .map(r => {
      const durMs   = r.duration_ms || (r.ended_at && r.started_at
        ? new Date(r.ended_at) - new Date(r.started_at)
        : 0);
      const expMs   = (EXPECTED_SEC[r.break_type] || 0) * 1000;
      const overMs  = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
      const isLate  = overMs > 0;
      const teamId  = r.team || profileTeams[r.user_id] || '';

      const endReasonMap = {
        early:         'VROEG',
        timer:         'TIMER',
        forfeit:       'VERLOPEN',
        'leader-ended':'ADMIN',
      };
      const eindstatus = isLate
        ? 'LAAT'
        : (endReasonMap[r.end_reason] || r.end_reason || '');

      // Logtekst — same phrases as the in-app log
      const logtekstMap = {
        brb:   'is even BRB gegaan...',
        short: 'heeft korte pauze genomen',
        lunch: 'heeft lunchpauze genomen',
      };
      const logtekst = logtekstMap[r.break_type] || '';

      // Pauze Tijd as H:MM:SS
      const pauzeMin = durMs > 0 ? msToHmmss(durMs) : '';

      // Log Tijd = ended_at or started_at
      const logTs = r.ended_at || r.started_at;

      return [
        getLabel(teamId),                                          // Team
        r.user_name || '',                                         // Naam
        logtekst,                                                  // Logtekst
        (r.break_type || '').toUpperCase(),                        // Type
        eindstatus,                                                // Eindstatus
        isLate ? msToHmmss(overMs) : '',                           // Overtijd (H:MM:SS)
        fmtTime(r.started_at),                                    // Start
        fmtTime(r.ended_at),                                      // Einde
        pauzeMin,                                                  // Pauze Tijd (min) — numeric
        fmtDt(logTs),                                             // Log Tijd
      ];
    });
}

// ── CSV serialiser ────────────────────────────────────────────────
function toCsv(rows) {
  const all = [CSV_HEADERS, ...rows];
  return '\uFEFF' + all.map(r =>
    r.map(c => {
      if (typeof c === 'number') return c;           // numbers unquoted → Excel treats as numeric
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
