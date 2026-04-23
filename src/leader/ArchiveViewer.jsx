import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { TEAM_LABELS, TEAM_COLORS, TYPES, teamTextColor } from '../lib/constants';
import { loadArchive, loadArchiveDates } from '../lib/state';

const adminLogAction = (e) => {
  const map = {
    reset:            'Alle tickets gereset',
    'ticket-add':     `Ticket toegevoegd · ${e.oldVal} → ${e.newVal}`,
    'ticket-remove':  `Ticket verwijderd · ${e.oldVal} → ${e.newVal}`,
    'extra-break':    `Extra korte pauze → ${e.userName}`,
    'remove-extra':   `Extra pauze verwijderd van ${e.userName}`,
    'leader-assign':  `Leiderrol toegewezen → ${e.userName}`,
    'leader-unassign':`Leiderrol verwijderd van ${e.userName}`,
    'team-assign':    `${e.userName} naar ${TEAM_LABELS[e.team] || e.team}`,
    'team-request':   `${e.userName} vraagt team ${TEAM_LABELS[e.newVal] || e.newVal}`,
    'set-default':    `Standaard opgeslagen (${TEAM_LABELS[e.team] || ''})`,
    'load-default':   `Standaard hersteld (${TEAM_LABELS[e.team] || ''})`,
    'clear-log':      'Logboek gewist',
  };
  return map[e.action] || e.action;
};

const endReasonText = { early: 'VROEG', timer: 'TIMER', forfeit: 'VERLOPEN', 'leader-ended': 'ADMIN' };

const EXPECTED_MS = { brb: 180000, short: 900000, lunch: 1800000 };

function calcLate(type, startedAt, endedAt) {
  if (!endedAt || !startedAt || !type) return { isLate: false, overMs: 0 };
  const durMs = endedAt - startedAt;
  const exp = EXPECTED_MS[type] || 0;
  const overMs = exp > 0 && durMs > exp ? durMs - exp : 0;
  return { isLate: overMs > 0, overMs };
}

function fmtOver(ms) {
  if (!ms) return '';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `+${m}m${s > 0 ? `${s}s` : ''}` : `+${s}s`;
}

function TeamPill({ team }) {
  if (!team) return <span />;
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
      background: TEAM_COLORS[team], color: teamTextColor(team),
      fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {TEAM_LABELS[team]}
    </span>
  );
}

function fmt2(ts, opts = { hour: '2-digit', minute: '2-digit' }) {
  if (!ts) return '–';
  return new Date(ts).toLocaleTimeString('nl-NL', opts);
}

// Column order (9 cols):
// team | naam | type | spacer | status | overtime | starttijd | eindtijd | logtijd(blue)
function BreakRow({ e }) {
  const { isLate, overMs } = calcLate(e.type, e.startedAt, e.endedAt);
  return (
    <li className="bm-admin-row">
      <TeamPill team={e.team} />
      <span className="bm-admin-name">{e.userName}</span>
      <span className={`bm-admin-type bm-admin-type-${e.type}`}>{TYPES[e.type]?.label || '–'}</span>
      <span />
      {/* status pill */}
      <span>
        {isLate
          ? <span className="bm-admin-late-pill">Laat</span>
          : <span className={`bm-admin-tag bm-admin-tag-${e.endReason || 'timer'}`}>{endReasonText[e.endReason] || e.endReason || '—'}</span>
        }
      </span>
      {/* overtime */}
      <span className="bm-admin-overtime">{isLate ? fmtOver(overMs) : ''}</span>
      {/* starttijd first */}
      <span className="bm-admin-time-cell">{fmt2(e.startedAt)}</span>
      {/* eindtijd second */}
      <span className="bm-admin-time-cell">{e.endedAt ? fmt2(e.endedAt) : '–'}</span>
      {/* logtijd — blue pill, rightmost */}
      <span className="bm-admin-tag bm-admin-tag-admin">{fmt2(e.endedAt || e.startedAt)}</span>
    </li>
  );
}

// Admin action row: team | naam | log tekst | [flex] | logtijd(blue pill)
function AdminRow({ e }) {
  return (
    <li className="bm-admin-row bm-admin-row-admin">
      <TeamPill team={e.team} />
      <span className="bm-admin-name" style={{ flexShrink: 0 }}>{e.adminName}</span>
      <span className="bm-admin-time-action">{adminLogAction(e)}</span>
      <span className="bm-admin-tag bm-admin-tag-admin">{fmt2(e.at)}</span>
    </li>
  );
}

// ── LogRow: picks the right variant ─────────────────────────────
function LogRow({ e, i }) {
  return e.kind === 'admin' ? <AdminRow key={i} e={e} /> : <BreakRow key={i} e={e} />;
}

// ── Export a day's logs to CSV ───────────────────────────────────
async function exportDayToCsv(date, notify) {
  const { data, error } = await sb.from('logs').select('*')
    .eq('log_date', date).order('started_at', { ascending: true });
  if (error || !data?.length) { notify?.('Geen logs gevonden', 'warn'); return; }

  const EXPECTED_SEC = { brb: 180, short: 900, lunch: 1800 };
  const rows = [
    ['Naam', 'Team', 'Type', 'Start', 'Einde', 'Duur (min)', 'Status', 'Laat?', 'Tijd+'],
    ...data.filter(r => r.kind !== 'admin').map(r => {
      const durMs = r.duration_ms || 0;
      const expMs = (EXPECTED_SEC[r.break_type] || 0) * 1000;
      const overMs = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
      return [
        r.user_name || '',
        r.action_data?.team || '',
        r.break_type || '',
        r.started_at ? new Date(r.started_at).toLocaleString('nl-NL') : '',
        r.ended_at   ? new Date(r.ended_at).toLocaleString('nl-NL')   : '',
        durMs ? (durMs / 60000).toFixed(1) : '',
        r.end_reason || '',
        r.break_type ? (overMs > 0 ? 'JA' : 'NEE') : '',
        overMs > 0 ? `+${(overMs / 60000).toFixed(1)} min` : '',
      ];
    })
  ];
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tbreak-log-${date}.csv`;
  a.click();
}

// ── Calendar dropdown ────────────────────────────────────────────
export function CalendarButton({ onOpenArchive, notify }) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [exportBusy, setExportBusy] = useState(null);

  useEffect(() => { loadArchiveDates().then(setDates); }, []);

  const handleOpen = async (d) => {
    const log = await loadArchive(d);
    setSelectedDate(d);
    onOpenArchive(d, log);
    setOpen(false);
  };

  const handleExport = async (e, d) => {
    e.stopPropagation();
    setExportBusy(d);
    await exportDayToCsv(d, notify);
    setExportBusy(null);
  };

  return (
    <div className="bm-cal-wrap">
      <button
        className={`bm-cal-btn ${open ? 'bm-cal-btn-active' : ''}`}
        onClick={() => { setOpen(v => !v); if (!open) loadArchiveDates().then(setDates); }}
        title="Logboek per dag"
      >
        📅
      </button>
      {open && (
        <div className="bm-cal-dropdown">
          <div className="bm-cal-title">Logboek per dag</div>
          {dates.length === 0 ? (
            <div className="bm-cal-empty">
              Nog geen archief.<br />Logs worden bewaard na middernacht.
            </div>
          ) : (
            <ul className="bm-cal-list">
              {dates.map(d => (
                <li key={d} className="bm-cal-item">
                  <button
                    className={`bm-cal-day ${selectedDate === d ? 'bm-cal-day-active' : ''}`}
                    onClick={() => handleOpen(d)}
                    title="Klik om te bekijken"
                  >
                    {new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', {
                      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </button>
                  <button
                    className="bm-cal-export-btn"
                    onClick={e => handleExport(e, d)}
                    title={`Exporteer ${d} naar .csv`}
                    disabled={exportBusy === d}
                  >
                    {exportBusy === d ? '…' : '↓'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Archive viewer panel ─────────────────────────────────────────
export function ArchiveViewer({ date, log, onClose, notify }) {
  if (!date || !log) return null;
  return (
    <div className="bm-leader-section bm-archive-section">
      <div className="bm-archive-header">
        <h3 className="bm-leader-h3">
          {new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="bm-btn bm-btn-ghost bm-btn-sm"
            onClick={() => exportDayToCsv(date, notify)} title="Exporteer als .csv">
            ↓ .csv
          </button>
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={onClose}>✕ Sluiten</button>
        </div>
      </div>
      {log.length === 0 ? (
        <div className="bm-empty">Geen logs voor deze dag.</div>
      ) : (
        <ul className="bm-admin-list">
          {log.map((e, i) => <LogRow key={i} e={e} i={i} />)}
        </ul>
      )}
    </div>
  );
}

// ── Today's log ──────────────────────────────────────────────────
export function LogToday({ log }) {
  return (
    <div className="bm-leader-section">
      <h3 className="bm-leader-h3">Logboek vandaag</h3>
      {log.length === 0 ? (
        <div className="bm-empty">Nog niets gelogd.</div>
      ) : (
        <ul className="bm-admin-list">
          {log.slice(0, 60).map((e, i) => <LogRow key={i} e={e} i={i} />)}
        </ul>
      )}
    </div>
  );
}
