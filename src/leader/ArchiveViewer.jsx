import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useResizableCols, LogHeader } from './ResizableLog';
import { sb } from '../lib/supabase';
import { TYPES } from '../lib/constants';
import { useTeams, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';
import { loadArchive, loadArchiveDates } from '../lib/state';
import { exportDayLogs, exportRangeLogs } from '../lib/export';

// ── Helpers ──────────────────────────────────────────────────────
const adminLogAction = (e, teams = []) => {
  const tl = (id) => getTeamLabel(teams, id) || id;
  const map = {
    reset:                   'Alle tickets gereset',
    'ticket-add':            `Ticket toegevoegd · ${e.oldVal} → ${e.newVal}`,
    'ticket-remove':         `Ticket verwijderd · ${e.oldVal} → ${e.newVal}`,
    'extra-break':           `Extra korte pauze → ${e.userName}`,
    'remove-extra':          `Extra pauze verwijderd van ${e.userName}`,
    'leader-assign':         `Leiderrol toegewezen → ${e.userName}`,
    'leader-unassign':       `Leiderrol verwijderd van ${e.userName}`,
    'team-assign':           `${e.userName} naar ${tl(e.team)}`,
    'team-request':          `${e.userName} vraagt team ${tl(e.newVal)}`,
    'team-switched':         `${e.userName} wisselde naar ${tl(e.newVal)}`,
    'team-request-approved': `Teamwijziging goedgekeurd: ${e.userName} → ${tl(e.newVal)}`,
    'team-request-denied':   `Teamwijziging afgewezen: ${e.userName} (${tl(e.oldVal)} → ${tl(e.newVal)})`,
    'set-default':           `Standaard opgeslagen (${tl(e.team)})`,
    'load-default':          `Standaard hersteld (${tl(e.team)})`,
    'clear-log':             'Logboek gewist',
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

function fmt2(ts, opts = { hour: '2-digit', minute: '2-digit' }) {
  if (!ts) return '–';
  return new Date(ts).toLocaleTimeString('nl-NL', opts);
}

function TeamPill({ team }) {
  const teams = useTeams();
  if (!team) return <span />;
  return (
    <span
      className="bm-user-team-pill"
      style={{
        background: getTeamColor(teams, team),
        color: getTeamTextColor(teams, team),
      }}
    >
      {getTeamLabel(teams, team)}
    </span>
  );
}

// ── Log row components ───────────────────────────────────────────
// 10-col: team | naam | log tekst | type | status | end-type | overtime | start | end | logtijd

function BreakRow({ e, gridTemplate }) {
  const { isLate, overMs } = calcLate(e.type, e.startedAt, e.endedAt);
  // Pauze duration in mm:ss
  const durMs = (e.startedAt && e.endedAt) ? e.endedAt - e.startedAt : 0;
  const pauzeStr = durMs > 0
    ? `${Math.floor(durMs/60000)}m${String(Math.floor((durMs%60000)/1000)).padStart(2,'0')}s`
    : '–';
  return (
    <li className="bm-admin-row" style={gridTemplate ? { gridTemplateColumns: gridTemplate } : undefined}>
      <TeamPill team={e.team} />
      <span className="bm-admin-name">{e.userName}</span>
      <span className="bm-admin-log-text">{{
        brb: 'is even BRB gegaan...',
        short: 'heeft korte pauze genomen',
        lunch: 'heeft lunchpauze genomen',
      }[e.type] || ''}</span>
      <span className={`bm-admin-type bm-admin-type-${e.type}`} data-label={TYPES[e.type]?.label || ''}>{TYPES[e.type]?.label || '–'}</span>
      <span>
        {isLate
          ? <span className="bm-admin-late-pill">LAAT</span>
          : <span className={`bm-admin-tag bm-admin-tag-${e.endReason || 'timer'}`}>
              {endReasonText[e.endReason] || e.endReason || '—'}
            </span>
        }
      </span>
      <span className="bm-admin-time-cell">{pauzeStr}</span>
      <span className="bm-admin-overtime">{isLate ? fmtOver(overMs) : ''}</span>
      <span className="bm-admin-time-cell">{fmt2(e.startedAt)}</span>
      <span className="bm-admin-time-cell">{e.endedAt ? fmt2(e.endedAt) : '–'}</span>
      <span className="bm-admin-tag bm-admin-tag-admin">{fmt2(e.endedAt || e.startedAt)}</span>
    </li>
  );
}

function AdminRow({ e, gridTemplate }) {
  const teams = useTeams();
  return (
    <li className="bm-admin-row bm-admin-row-admin" style={gridTemplate ? { gridTemplateColumns: gridTemplate } : undefined}>
      <TeamPill team={e.team} />
      <span className="bm-admin-name">{e.adminName}</span>
      <span className="bm-admin-time-action">{adminLogAction(e, teams)}</span>
      {/* type | eindstatus | overtime | start | einde | pauzetijd — all empty for admin rows */}
      <span /><span /><span /><span /><span /><span />
      <span className="bm-admin-tag bm-admin-tag-admin">{fmt2(e.at)}</span>
    </li>
  );
}

function LogRow({ e, i, gridTemplate }) {
  return e.kind === 'admin' ? <AdminRow key={i} e={e} gridTemplate={gridTemplate} /> : <BreakRow key={i} e={e} gridTemplate={gridTemplate} />;
}

// ── Calendar modal ───────────────────────────────────────────────
export function CalendarButton({ onOpenArchive, notify }) {
  const teams = useTeams();
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [mode, setMode] = useState('single');
  const [selectedDate, setSelectedDate] = useState(null);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) loadArchiveDates().then(setDates); }, [open]);

  const today = new Date().toISOString().slice(0, 10);

  const calDays = () => {
    const { year, month } = viewMonth;
    const first = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (first + 6) % 7;
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
    return cells;
  };

  const prevMonth = () => setViewMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setViewMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const handleDayClick = (iso) => {
    if (!iso || iso > today || !dates.includes(iso)) return;
    if (mode === 'single') {
      setSelectedDate(iso);
    } else {
      // First click or reset: set start
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(iso); setRangeEnd(null);
      } else if (iso === rangeStart) {
        // Clicking same date again — reset
        setRangeStart(null);
      } else {
        // Second click: set end, ensure start < end
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

  const monthName = new Date(viewMonth.year, viewMonth.month, 1)
    .toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  return (
    <div className="bm-cal-wrap">
      <button className={`bm-cal-btn ${open ? 'bm-cal-btn-active' : ''}`}
        onClick={() => setOpen(v => !v)} title="Logboek per dag">
        <svg className="bm-cal-btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
          <rect x="2" y="3" width="12" height="12" rx="2"/>
          <path d="M5 1v4M11 1v4M2 7h12"/>
          <text x="8" y="13.5" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Geist,sans-serif">17</text>
        </svg>
        Logboek
      </button>
      {open && createPortal(
        <div className="bm-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="bm-cal-modal" onClick={e => e.stopPropagation()}>
            <div className="bm-cal-modal-header">
              <span className="bm-modal-title">Logboek archief</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={`bm-btn bm-btn-sm ${mode==='single'?'bm-btn-primary':'bm-btn-ghost'}`}
                  onClick={() => { setMode('single'); setRangeStart(null); setRangeEnd(null); }}>Dag</button>
                <button className={`bm-btn bm-btn-sm ${mode==='range'?'bm-btn-primary':'bm-btn-ghost'}`}
                  onClick={() => { setMode('range'); setSelectedDate(null); }}>Periode</button>
                <button className="bm-modal-close" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>

            <div className="bm-cal-nav">
              <button className="bm-cal-nav-btn" onClick={prevMonth}>‹</button>
              <span className="bm-cal-month-label">{monthName}</span>
              <button className="bm-cal-nav-btn" onClick={nextMonth}>›</button>
            </div>

            <div className="bm-cal-grid">
              {['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d => (
                <div key={d} className="bm-cal-grid-header">{d}</div>
              ))}
              {calDays().map((iso, i) => {
                if (!iso) return <div key={`e-${i}`} />;
                const hasLog = dates.includes(iso);
                const isFuture = iso > today;
                const isSel = mode === 'single' ? iso === selectedDate : inRange(iso);
                const isEdge = mode === 'range' && (iso === rangeStart || iso === rangeEnd);
                return (
                  <button key={iso}
                    className={['bm-cal-grid-day',
                      hasLog ? 'bm-cal-grid-day-has-log' : '',
                      isFuture ? 'bm-cal-grid-day-future' : '',
                      isSel ? 'bm-cal-grid-day-selected' : '',
                      isEdge ? 'bm-cal-grid-day-range-edge' : '',
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

            <div className="bm-cal-selection-info">
              {mode === 'single' && selectedDate && (
                <span>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</span>
              )}
              {mode === 'range' && rangeStart && !rangeEnd && <span>Selecteer einddatum…</span>}
              {mode === 'range' && rangeStart && rangeEnd && <span>{rangeStart} → {rangeEnd}</span>}
              {!selectedDate && !rangeStart && (
                <span className="bm-cal-hint">{mode==='single' ? 'Klik op een dag met een stip' : 'Klik op begin- en einddatum'}</span>
              )}
            </div>

            <div className="bm-cal-modal-footer">
              {mode === 'single' && <>
                <button className="bm-btn bm-btn-primary bm-btn-sm"
                  disabled={!selectedDate || busy} onClick={showLog}>
                  {busy ? '…' : '👁 Toon log'}
                </button>
                <button className="bm-btn bm-btn-ghost bm-btn-sm"
                  disabled={!selectedDate || busy}
                  onClick={async () => { setBusy(true); await exportDayLogs(selectedDate, teams, notify); setBusy(false); }}>
                  {busy ? '…' : '↓ Export .csv'}
                </button>
              </>}
              {mode === 'range' && (
                <button className="bm-btn bm-btn-primary bm-btn-sm"
                  disabled={!rangeStart || !rangeEnd || busy}
                  onClick={async () => { setBusy(true); await exportRangeLogs(rangeStart, rangeEnd, teams, notify); setBusy(false); }}>
                  {busy ? '…' : '↓ Export periode naar .csv'}
                </button>
              )}
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setOpen(false)}>Annuleren</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Archive viewer panel ─────────────────────────────────────────
export function ArchiveViewer({ date, log, onClose, notify }) {
  const teams = useTeams();
  const { gridTemplate, startDrag } = useResizableCols();
  if (!date || !log) return null;
  return (
    <div className="bm-leader-section bm-archive-section">
      <div className="bm-archive-header">
        <h3 className="bm-leader-h3">
          {new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="bm-cal-btn"
            onClick={() => exportDayLogs(date, teams, notify)} title="Exporteer als .csv">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v8m-4-3 4 4 4-4"/><path d="M3 14h10"/></svg>
            Export .csv
          </button>
          <button className="bm-cal-btn" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            Sluiten
          </button>
        </div>
      </div>
      {log.length === 0
        ? <div className="bm-empty">Geen logs voor deze dag.</div>
        : <div className="bm-log-wrap">
            <LogHeader gridTemplate={gridTemplate} startDrag={startDrag} />
            <ul className="bm-admin-list" style={{ '--log-grid': gridTemplate }}>
              {log.map((e, i) => <LogRow key={i} e={e} i={i} gridTemplate={gridTemplate} />)}
            </ul>
          </div>
      }
    </div>
  );
}

// ── Today's log ──────────────────────────────────────────────────
export function LogToday({ log }) {
  const { gridTemplate, startDrag } = useResizableCols();
  return (
    <div className="bm-leader-section">
      <h3 className="bm-leader-h3">Logboek vandaag</h3>
      {log.length === 0
        ? <div className="bm-empty">Nog niets gelogd.</div>
        : <div className="bm-log-wrap">
            <LogHeader gridTemplate={gridTemplate} startDrag={startDrag} />
            <ul className="bm-admin-list" style={{ '--log-grid': gridTemplate }}>
              {log.slice(0, 60).map((e, i) => <LogRow key={i} e={e} i={i} gridTemplate={gridTemplate} />)}
            </ul>
          </div>
      }
    </div>
  );
}
