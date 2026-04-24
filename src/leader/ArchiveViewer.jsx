import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { TEAM_LABELS, TEAM_COLORS, TYPES, teamTextColor } from '../lib/constants';
import { loadArchive, loadArchiveDates } from '../lib/state';

const adminLogAction = (e) => {
  const map = {
    reset:                  'Alle tickets gereset',
    'ticket-add':           `Ticket toegevoegd · ${e.oldVal} → ${e.newVal}`,
    'ticket-remove':        `Ticket verwijderd · ${e.oldVal} → ${e.newVal}`,
    'extra-break':          `Extra korte pauze → ${e.userName}`,
    'remove-extra':         `Extra pauze verwijderd van ${e.userName}`,
    'leader-assign':        `Leiderrol toegewezen → ${e.userName}`,
    'leader-unassign':      `Leiderrol verwijderd van ${e.userName}`,
    'team-assign':          `${e.userName} naar ${TEAM_LABELS[e.team] || e.team}`,
    'team-request':         `${e.userName} vraagt team ${TEAM_LABELS[e.newVal] || e.newVal}`,
    'team-switched':        `${e.userName} wisselde naar ${TEAM_LABELS[e.newVal] || e.newVal}`,
    'team-request-approved':`Teamwijziging goedgekeurd: ${e.userName} → ${TEAM_LABELS[e.newVal] || e.newVal}`,
    'team-request-denied':  `Teamwijziging afgewezen: ${e.userName} (${TEAM_LABELS[e.oldVal] || e.oldVal} → ${TEAM_LABELS[e.newVal] || e.newVal})`,
    'set-default':          `Standaard opgeslagen (${TEAM_LABELS[e.team] || ''})`,
    'load-default':         `Standaard hersteld (${TEAM_LABELS[e.team] || ''})`,
    'clear-log':            'Logboek gewist',
    'user-login':           `${e.userName} heeft ingelogd`,
    'user-logout':          `${e.userName} heeft uitgelogd`,
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
// team | naam | log tekst (1fr) | type | status | overtime | starttijd | eindtijd | logtijd(blue)
function BreakRow({ e }) {
  const { isLate, overMs } = calcLate(e.type, e.startedAt, e.endedAt);
  return (
    <li className="bm-admin-row">
      <TeamPill team={e.team} />
      <span className="bm-admin-name">{e.userName}</span>
      <span />  {/* 1fr spacer */}
      <span className={`bm-admin-type bm-admin-type-${e.type}`}>{TYPES[e.type]?.label || '–'}</span>
      <span>
        {isLate
          ? <span className="bm-admin-late-pill">Laat</span>
          : <span className={`bm-admin-tag bm-admin-tag-${e.endReason || 'timer'}`}>{endReasonText[e.endReason] || e.endReason || '—'}</span>
        }
      </span>
      <span className="bm-admin-overtime">{isLate ? fmtOver(overMs) : ''}</span>
      <span className="bm-admin-time-cell">{fmt2(e.startedAt)}</span>
      <span className="bm-admin-time-cell">{e.endedAt ? fmt2(e.endedAt) : '–'}</span>
      <span className="bm-admin-tag bm-admin-tag-admin">{fmt2(e.endedAt || e.startedAt)}</span>
    </li>
  );
}

// Admin action row — same 9-col grid as BreakRow, unused cells are empty spans
// team | naam | [empty type] | log tekst (1fr) | [empty status] | [empty overtime] | [empty start] | [empty end] | logtijd(blue)
function AdminRow({ e }) {
  return (
    <li className="bm-admin-row bm-admin-row-admin">
      <TeamPill team={e.team} />
      <span className="bm-admin-name">{e.adminName}</span>
      <span className="bm-admin-time-action">{adminLogAction(e)}</span>
      {/* type | status | overtime | start | end — all empty, logtijd last */}
      <span /><span /><span /><span /><span />
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

// ── Calendar modal ───────────────────────────────────────────────
export function CalendarButton({ onOpenArchive, notify }) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState([]); // available log dates from Supabase
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [mode, setMode] = useState('single'); // 'single' | 'range'
  const [selectedDate, setSelectedDate] = useState(null);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) loadArchiveDates().then(setDates);
  }, [open]);

  const today = new Date().toISOString().slice(0, 10);

  // Build calendar grid for viewMonth
  const calDays = () => {
    const { year, month } = viewMonth;
    const first = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (first + 6) % 7; // Mon-based
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push(iso);
    }
    return cells;
  };

  const prevMonth = () => setViewMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setViewMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const handleDayClick = (iso) => {
    if (!iso || iso > today) return;
    if (!dates.includes(iso)) return; // no logs for this day
    if (mode === 'single') {
      setSelectedDate(iso);
    } else {
      // Range selection: first click sets start, second sets end
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(iso); setRangeEnd(null);
      } else {
        if (iso < rangeStart) { setRangeEnd(rangeStart); setRangeStart(iso); }
        else { setRangeEnd(iso); }
      }
    }
  };

  const inRange = (iso) => {
    if (mode !== 'range' || !rangeStart) return false;
    const end = rangeEnd || rangeStart;
    return iso >= rangeStart && iso <= end;
  };

  const showLog = async () => {
    if (!selectedDate) return;
    setBusy(true);
    const log = await loadArchive(selectedDate);
    onOpenArchive(selectedDate, log);
    setBusy(false);
    setOpen(false);
  };

  const exportSingle = async () => {
    if (!selectedDate) return;
    setBusy(true);
    await exportDayToCsv(selectedDate, notify);
    setBusy(false);
  };

  const exportRange = async () => {
    if (!rangeStart || !rangeEnd) return;
    setBusy(true);
    // Fetch all logs for date range in one query
    const { data, error } = await sb.from('logs').select('*')
      .gte('log_date', rangeStart).lte('log_date', rangeEnd)
      .order('log_date').order('started_at');
    setBusy(false);
    if (error || !data?.length) { notify?.('Geen logs gevonden', 'warn'); return; }
    const EXPECTED_SEC = { brb: 180, short: 900, lunch: 1800 };
    const rows = [
      ['Datum', 'Naam', 'Team', 'Type', 'Start', 'Einde', 'Duur (min)', 'Status', 'Laat?', 'Tijd+'],
      ...data.filter(r => r.kind !== 'admin').map(r => {
        const durMs = r.duration_ms || 0;
        const expMs = (EXPECTED_SEC[r.break_type] || 0) * 1000;
        const overMs = expMs > 0 && durMs > expMs ? durMs - expMs : 0;
        return [
          r.log_date, r.user_name || '', r.action_data?.team || '',
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
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tbreak-${rangeStart}--${rangeEnd}.csv`;
    a.click();
  };

  const monthName = new Date(viewMonth.year, viewMonth.month, 1)
    .toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  return (
    <div className="bm-cal-wrap">
      <button className={`bm-cal-btn ${open ? 'bm-cal-btn-active' : ''}`}
        onClick={() => setOpen(v => !v)} title="Logboek per dag">
        📅
      </button>
      {open && (
        <div className="bm-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="bm-cal-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bm-cal-modal-header">
              <span className="bm-modal-title">Logboek archief</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className={`bm-btn bm-btn-sm ${mode === 'single' ? 'bm-btn-primary' : 'bm-btn-ghost'}`}
                  onClick={() => { setMode('single'); setRangeStart(null); setRangeEnd(null); }}>
                  Dag
                </button>
                <button
                  className={`bm-btn bm-btn-sm ${mode === 'range' ? 'bm-btn-primary' : 'bm-btn-ghost'}`}
                  onClick={() => { setMode('range'); setSelectedDate(null); }}>
                  Periode
                </button>
                <button className="bm-modal-close" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>

            {/* Month navigation */}
            <div className="bm-cal-nav">
              <button className="bm-cal-nav-btn" onClick={prevMonth}>‹</button>
              <span className="bm-cal-month-label">{monthName}</span>
              <button className="bm-cal-nav-btn" onClick={nextMonth}>›</button>
            </div>

            {/* Weekday labels */}
            <div className="bm-cal-grid">
              {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => (
                <div key={d} className="bm-cal-grid-header">{d}</div>
              ))}
              {calDays().map((iso, i) => {
                if (!iso) return <div key={`empty-${i}`} />;
                const hasLog = dates.includes(iso);
                const isFuture = iso > today;
                const isSel = mode === 'single' ? iso === selectedDate : inRange(iso);
                const isRangeEdge = mode === 'range' && (iso === rangeStart || iso === rangeEnd);
                return (
                  <button key={iso}
                    className={[
                      'bm-cal-grid-day',
                      hasLog ? 'bm-cal-grid-day-has-log' : '',
                      isFuture ? 'bm-cal-grid-day-future' : '',
                      isSel ? 'bm-cal-grid-day-selected' : '',
                      isRangeEdge ? 'bm-cal-grid-day-range-edge' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={!hasLog || isFuture}
                    onClick={() => handleDayClick(iso)}
                    title={hasLog ? iso : 'Geen logs'}
                  >
                    {parseInt(iso.slice(8))}
                    {hasLog && <span className="bm-cal-dot" />}
                  </button>
                );
              })}
            </div>

            {/* Status line */}
            <div className="bm-cal-selection-info">
              {mode === 'single' && selectedDate && (
                <span>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</span>
              )}
              {mode === 'range' && rangeStart && !rangeEnd && (
                <span>Selecteer einddatum…</span>
              )}
              {mode === 'range' && rangeStart && rangeEnd && (
                <span>{rangeStart} → {rangeEnd}</span>
              )}
              {!selectedDate && !rangeStart && (
                <span className="bm-cal-hint">
                  {mode === 'single' ? 'Klik op een dag met een stip' : 'Klik op begin- en einddatum'}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="bm-cal-modal-footer">
              {mode === 'single' && (
                <>
                  <button className="bm-btn bm-btn-primary bm-btn-sm"
                    disabled={!selectedDate || busy} onClick={showLog}>
                    {busy ? '…' : '👁 Toon log'}
                  </button>
                  <button className="bm-btn bm-btn-ghost bm-btn-sm"
                    disabled={!selectedDate || busy} onClick={exportSingle}>
                    {busy ? '…' : '↓ Export .csv'}
                  </button>
                </>
              )}
              {mode === 'range' && (
                <button className="bm-btn bm-btn-primary bm-btn-sm"
                  disabled={!rangeStart || !rangeEnd || busy} onClick={exportRange}>
                  {busy ? '…' : `↓ Export periode naar .csv`}
                </button>
              )}
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setOpen(false)}>
                Annuleren
              </button>
            </div>
          </div>
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
