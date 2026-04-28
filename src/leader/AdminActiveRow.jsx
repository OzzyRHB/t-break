import { useTeams, getTeamColor, getTeamTextColor, getTeamLabel } from '../lib/TeamsContext';
import { TYPES } from '../lib/constants';
import { fmt, fmtMs } from '../lib/helpers';

function TeamPill({ team }) {
  const teams = useTeams();
  if (!team) return <span />;
  return (
    <span style={{
      fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
      background: getTeamColor(teams, team), color: getTeamTextColor(teams, team),
      fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {getTeamLabel(teams, team)}
    </span>
  );
}

export function AdminActiveRow({ b, config, onEnd }) {
  const dur = config[TYPES[b.type].durKey];
  const endAt = b.startedAt + dur * 1000;
  const now = Date.now();
  const remaining = Math.max(0, Math.round((endAt - now) / 1000));
  const over = now > endAt;
  const overBy = over ? now - endAt : 0;

  // Use same 10-column grid as log rows:
  // team | naam | live counter (log text col) | type | status | endtype | overtime | start | end | logtijd
  return (
    <li className={`bm-admin-row ${over ? 'bm-admin-row-over' : ''}`}>
      <TeamPill team={b.team} />
      <span className="bm-admin-name">{b.userName}</span>
      {/* Log text col — live countdown */}
      <span className="bm-admin-time" style={{ fontFamily: 'Geist Mono', fontSize: 12, color: over ? 'var(--danger)' : 'var(--ink-2)' }}>
        {over ? `+${fmtMs(overBy)} overtijd` : `${fmt(remaining)} resterend`}
      </span>
      {/* Break type */}
      <span className={`bm-admin-type bm-admin-type-${b.type}`}>{TYPES[b.type].label}</span>
      {/* Status — always "op pauze" */}
      <span className="bm-user-dot bm-user-dot-break" style={{ fontSize: 10 }}>op pauze</span>
      {/* End-type — empty until break ends */}
      <span />
      {/* Overtime */}
      <span className="bm-admin-overtime">{over ? `+${fmtMs(overBy)}` : ''}</span>
      {/* Start time */}
      <span className="bm-admin-time-cell">
        {new Date(b.startedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
      </span>
      {/* End time — empty */}
      <span className="bm-admin-time-cell">–</span>
      {/* Beëindig button in logtijd col */}
      <button className="bm-btn bm-btn-xs bm-btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={onEnd}>
        Beëindig
      </button>
    </li>
  );
}
