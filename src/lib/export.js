import { sb } from './supabase';

const EXPECTED_SEC = { brb: 180, short: 900, lunch: 1800 };

function buildRows(data, teams = []) {
  const getLabel = (id) => teams.find(t => t.id === id)?.label || id || '';

  return data
    .filter(r => r.kind !== 'admin' && r.break_type)
    .map(r => {
      const durMs = r.duration_ms || 0;
      const expMs = (EXPECTED_SEC[r.break_type] || 0) * 1000;
      const overMs = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
      const isLate = overMs > 0;
      return [
        r.log_date                                                  || '',
        r.user_name                                                 || '',
        getLabel(r.action_data?.team || ''),
        r.break_type                                                || '',
        r.started_at ? new Date(r.started_at).toLocaleString('nl-NL') : '',
        r.ended_at   ? new Date(r.ended_at).toLocaleString('nl-NL')   : '',
        durMs        ? (durMs / 60000).toFixed(1)                      : '',
        r.end_reason                                                || '',
        r.break_type ? (isLate ? 'JA' : 'NEE')                     : '',
        isLate       ? `+${(overMs / 60000).toFixed(1)} min`       : '',
      ];
    });
}

const HEADERS = ['Datum', 'Naam', 'Team', 'Type', 'Start', 'Einde', 'Duur (min)', 'Status', 'Laat?', 'Tijd+'];

function toCsv(rows) {
  const all = [HEADERS, ...rows];
  return '\uFEFF' + all.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

function download(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Export logs for a single user (from UserManagement or admin dots menu)
export async function exportUserLogs(userId, userName, teams = [], notify) {
  const today = new Date().toISOString().slice(0, 10);
  let { data } = await sb.from('logs').select('*').eq('user_id', userId)
    .order('started_at', { ascending: true });
  // Fallback to name query for pre-fix logs
  if (!data?.length) {
    const byName = await sb.from('logs').select('*').eq('user_name', userName)
      .order('started_at', { ascending: true });
    data = byName.data;
  }
  if (!data?.length) { notify?.('Geen logs gevonden', 'warn'); return; }
  const rows = buildRows(data, teams);
  if (!rows.length) { notify?.('Geen pauze-logs gevonden', 'warn'); return; }
  download(toCsv(rows), `tbreak-${userName.replace(/\s+/g, '-')}-alle-logs.csv`);
}

// Export logs for a single user with date range
export async function exportUserLogsRange(userId, userName, from, to, teams = [], notify) {
  let { data } = await sb.from('logs').select('*').eq('user_id', userId)
    .gte('log_date', from).lte('log_date', to)
    .order('started_at', { ascending: true });
  if (!data?.length) {
    const byName = await sb.from('logs').select('*').eq('user_name', userName)
      .gte('log_date', from).lte('log_date', to)
      .order('started_at', { ascending: true });
    data = byName.data;
  }
  if (!data?.length) { notify?.('Geen logs gevonden voor deze periode', 'warn'); return; }
  const rows = buildRows(data, teams);
  download(toCsv(rows), `tbreak-${userName.replace(/\s+/g, '-')}-${from}--${to}.csv`);
}

// Export all logs for a single day (calendar)
export async function exportDayLogs(date, teams = [], notify) {
  const { data, error } = await sb.from('logs').select('*')
    .eq('log_date', date).order('started_at', { ascending: true });
  if (error || !data?.length) { notify?.('Geen logs gevonden', 'warn'); return; }
  const rows = buildRows(data, teams);
  download(toCsv(rows), `tbreak-log-${date}.csv`);
}

// Export all logs for a date range (calendar range export)
export async function exportRangeLogs(from, to, teams = [], notify) {
  const { data, error } = await sb.from('logs').select('*')
    .gte('log_date', from).lte('log_date', to)
    .order('log_date').order('started_at');
  if (error || !data?.length) { notify?.('Geen logs gevonden voor deze periode', 'warn'); return; }
  const rows = buildRows(data, teams);
  download(toCsv(rows), `tbreak-${from}--${to}.csv`);
}
