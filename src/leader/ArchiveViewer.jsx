import { useEffect, useState } from 'react';
import { TEAM_LABELS, TEAM_COLORS, TYPES, teamTextColor } from '../lib/constants';
import { loadArchive, loadArchiveDates } from '../lib/state';

const adminLogAction = (e) => {
  const map = {
    reset: 'Alle tickets gereset',
    'ticket-add': `Ticket toegevoegd · ${e.oldVal} → ${e.newVal}`,
    'ticket-remove': `Ticket verwijderd · ${e.oldVal} → ${e.newVal}`,
    'extra-break': `Extra korte pauze → ${e.userName}`,
    'remove-extra': `Extra pauze verwijderd van ${e.userName}`,
    'leader-assign': `Leiderrol toegewezen → ${e.userName}`,
    'leader-unassign': `Leiderrol verwijderd van ${e.userName}`,
    'team-assign': `${e.userName} naar ${TEAM_LABELS[e.team] || e.team}`,
    'team-request': `${e.userName} vraagt team ${TEAM_LABELS[e.newVal] || e.newVal}`,
    'set-default': `Standaard opgeslagen (${TEAM_LABELS[e.team] || ''})`,
    'load-default': `Standaard hersteld (${TEAM_LABELS[e.team] || ''})`,
  };
  return map[e.action] || e.action;
};

const endReasonText = {
  early: 'vroeg',
  timer: 'timer',
  forfeit: 'verlopen',
  'leader-ended': 'beëindigd',
};

function TeamPill({ team }) {
  if (!team) return null;
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 8px',
        borderRadius: '4px',
        background: TEAM_COLORS[team],
        color: teamTextColor(team),
        fontWeight: 600,
      }}
    >
      {TEAM_LABELS[team]}
    </span>
  );
}

export function CalendarButton({ onOpenArchive }) {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { loadArchiveDates().then(setDates); }, []);

  const handleOpen = async (d) => {
    const log = await loadArchive(d);
    setSelectedDate(d);
    onOpenArchive(d, log);
    setOpen(false);
  };

  return (
    <div className="bm-cal-wrap">
      <button
        className={`bm-cal-btn ${open ? 'bm-cal-btn-active' : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) loadArchiveDates().then(setDates);
        }}
        title="Logboek per dag"
      >
        📅
      </button>
      {open && (
        <div className="bm-cal-dropdown">
          <div className="bm-cal-title">Logboek per dag</div>
          {dates.length === 0 ? (
            <div className="bm-cal-empty">
              Nog geen archief.
              <br />
              Logs worden bewaard na middernacht.
            </div>
          ) : (
            <ul className="bm-cal-list">
              {dates.map((d) => (
                <li key={d}>
                  <button
                    className={`bm-cal-day ${selectedDate === d ? 'bm-cal-day-active' : ''}`}
                    onClick={() => handleOpen(d)}
                  >
                    {new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
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

export function ArchiveViewer({ date, log, onClose }) {
  if (!date || !log) return null;
  return (
    <div className="bm-leader-section bm-archive-section">
      <div className="bm-archive-header">
        <h3 className="bm-leader-h3">
          {new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h3>
        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={onClose}>
          ✕ Sluiten
        </button>
      </div>
      {log.length === 0 ? (
        <div className="bm-empty">Geen logs voor deze dag.</div>
      ) : (
        <ul className="bm-admin-list">
          {log.map((e, i) =>
            e.kind === 'admin' ? (
              <li key={i} className="bm-admin-row bm-admin-row-admin">
                <span className="bm-admin-name">{e.adminName}</span>
                <TeamPill team={e.team} />
                <span className="bm-admin-time bm-admin-time-action">{adminLogAction(e)}</span>
                <span className="bm-admin-tag bm-admin-tag-admin">
                  {new Date(e.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ) : (
              <li key={i} className="bm-admin-row">
                <span className="bm-admin-name">{e.userName}</span>
                <span className={`bm-admin-type bm-admin-type-${e.type}`}>{TYPES[e.type]?.label}</span>
                <span className="bm-admin-time">
                  {new Date(e.startedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {e.endedAt
                    ? new Date(e.endedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                    : '–'}
                </span>
                <span className={`bm-admin-tag bm-admin-tag-${e.endReason}`}>
                  {endReasonText[e.endReason] || e.endReason}
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

export function LogToday({ log }) {
  return (
    <div className="bm-leader-section">
      <h3 className="bm-leader-h3">Logboek vandaag</h3>
      {log.length === 0 ? (
        <div className="bm-empty">Nog niets gelogd.</div>
      ) : (
        <ul className="bm-admin-list">
          {log.slice(0, 60).map((e, i) =>
            e.kind === 'admin' ? (
              <li key={i} className="bm-admin-row bm-admin-row-admin">
                <span className="bm-admin-name">{e.adminName}</span>
                <TeamPill team={e.team} />
                <span className="bm-admin-time bm-admin-time-action">{adminLogAction(e)}</span>
                <span className="bm-admin-tag bm-admin-tag-admin">
                  {new Date(e.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ) : (
              <li key={i} className="bm-admin-row">
                <span className="bm-admin-name">{e.userName}</span>
                <TeamPill team={e.team} />
                <span className={`bm-admin-type bm-admin-type-${e.type}`}>{TYPES[e.type]?.label}</span>
                <span className="bm-admin-time">
                  {new Date(e.startedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {e.endedAt
                    ? new Date(e.endedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                    : '–'}
                </span>
                <span className={`bm-admin-tag bm-admin-tag-${e.endReason}`}>
                  {endReasonText[e.endReason] || e.endReason}
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
