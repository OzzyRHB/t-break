import { sb } from './supabase';

const EXPECTED_SEC = { brb: 180, short: 900, lunch: 1800 };

export const CSV_HEADERS = [
  'Team', 'Naam', 'Datum', 'Type',
  'Eindstatus', 'Overtijd (min)', 'Start', 'Einde', 'Logtijd'
];

async function buildRows(data, teams = []) {
  const getLabel = (id) => teams.find(t => t.id === id)?.label || id || '';

  // Build user_id → team lookup from profiles for rows that don't have team stored
  const userIds = [...new Set(data.filter(r => !r.team && r.user_id).map(r => r.user_id))];
  const profileTeams = {};
  if (userIds.length > 0) {
    const { data: profiles } = await sb.from('profiles').select('id, team, name').in('id', userIds);
    profiles?.forEach(p => { profileTeams[p.id] = p.team; });
  }

  return data
    .filter(r => r.kind !== 'admin' && r.break_type)
    .map(r => {
      const durMs = r.duration_ms || 0;
      const expMs = (EXPECTED_SEC[r.break_type] || 0) * 1000;
      const overMs = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
      const isLate = overMs > 0;
      const teamId = r.team || profileTeams[r.user_id] || '';
      const endReasonMap = { early: 'VROEG', timer: 'TIMER', forfeit: 'VERLOPEN', 'leader-ended': 'ADMIN' };
      const eindstatus = isLate ? 'LAAT' : (endReasonMap[r.end_reason] || r.end_reason || '');
      const fmtDt = (ts) => ts ? new Date(ts).toLocaleString('nl-NL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }) : '';
      const logtime = r.ended_at || r.started_at;
      return [
        getLabel(teamId),
        r.user_name || '',
        r.log_date || '',
        r.break_type || '',
        eindstatus,
        // Numeric decimal minutes — no label, no "+", so Excel/Libre SUM works directly
        isLate ? parseFloat((overMs / 60000).toFixed(2)) : '',
        fmtDt(r.started_at),
        fmtDt(r.ended_at),
        fmtDt(logtime),
      ];
    });
}

function toCsv(rows) {
  const all = [CSV_HEADERS, ...rows];
  return '\uFEFF' + all.map(r =>
    r.map(c => {
      // Numbers go unquoted so Excel recognises them as numeric
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

async function fetchLogs(filters, notify) {
  let q = sb.from('logs').select('*');
  if (filters.userId) q = q.eq('user_id', filters.userId);
  if (filters.userName && !filters.userId) q = q.eq('user_name', filters.userName);
  if (filters.from) q = q.gte('log_date', filters.from);
  if (filters.to) q = q.lte('log_date', filters.to);
  q = q.order('log_date').order('started_at');
  let { data } = await q;
  // Fallback to name query if no results by ID
  if (!data?.length && filters.userId && filters.userName) {
    let q2 = sb.from('logs').select('*').eq('user_name', filters.userName);
    if (filters.from) q2 = q2.gte('log_date', filters.from);
    if (filters.to) q2 = q2.lte('log_date', filters.to);
    q2 = q2.order('log_date').order('started_at');
    const { data: d2 } = await q2;
    data = d2;
  }
  if (!data?.length) { notify?.('Geen logs gevonden', 'warn'); return null; }
  return data;
}

// ── Public export functions — all produce identical CSV format ────

export async function exportUserLogs(userId, userName, teams = [], notify) {
  const data = await fetchLogs({ userId, userName }, notify);
  if (!data) return;
  download(toCsv(await buildRows(data, teams)), `tbreak-${userName.replace(/\s+/g, '-')}-alle-logs.csv`);
}

export async function exportUserLogsRange(userId, userName, from, to, teams = [], notify) {
  const data = await fetchLogs({ userId, userName, from, to }, notify);
  if (!data) return;
  download(toCsv(await buildRows(data, teams)), `tbreak-${userName.replace(/\s+/g, '-')}-${from}--${to}.csv`);
}

export async function exportDayLogs(date, teams = [], notify) {
  const data = await fetchLogs({ from: date, to: date }, notify);
  if (!data) return;
  download(toCsv(await buildRows(data, teams)), `tbreak-log-${date}.csv`);
}

export async function exportRangeLogs(from, to, teams = [], notify) {
  const data = await fetchLogs({ from, to }, notify);
  if (!data) return;
  download(toCsv(await buildRows(data, teams)), `tbreak-logs-${from}--${to}.csv`);
}
