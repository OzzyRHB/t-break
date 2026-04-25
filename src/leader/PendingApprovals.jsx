import { useTeams, getTeamLabel } from '../lib/TeamsContext';

export function PendingApprovals({ pendingUsers, teamRequests, onApprove, onApproveTeam, onDenyTeam }) {
  const teams = useTeams();
  return (
    <>
      {pendingUsers.length > 0 && (
        <div className="bm-leader-section bm-pending-section">
          <h3 className="bm-leader-h3" style={{ color: 'var(--brand)' }}>
            Wachtend op goedkeuring{' '}
            <span className="bm-leader-h3-count">{pendingUsers.length}</span>
          </h3>
          <ul className="bm-admin-list">
            {pendingUsers.map((u) => (
              <li key={u.id} className="bm-admin-row bm-pending-row">
                <span className="bm-admin-name">{u.name}</span>
                <span className="bm-admin-time" style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
                  {u.email}
                </span>
                <button className="bm-btn bm-btn-primary bm-btn-xs" onClick={() => onApprove(u.id, false)}>
                  Goedkeuren
                </button>
                <button className="bm-btn bm-btn-ghost bm-btn-xs" onClick={() => onApprove(u.id, true)}>
                  +Leider
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {teamRequests.length > 0 && (
        <div className="bm-leader-section bm-pending-section">
          <h3 className="bm-leader-h3" style={{ color: 'var(--amber)' }}>
            Teamwijzigingsverzoeken <span className="bm-leader-h3-count">{teamRequests.length}</span>
          </h3>
          <ul className="bm-admin-list">
            {teamRequests.map((r) => (
              <li key={r.id} className="bm-admin-row bm-admin-row-request">
                <span className="bm-admin-name">{r.user_name}</span>
                <span className="bm-admin-time">
                  {getTeamLabel(teams, r.from_team) || '?'} → {getTeamLabel(teams, r.to_team)}
                </span>
                <button className="bm-btn bm-btn-primary bm-btn-xs" onClick={() => onApproveTeam(r)}>
                  Goedkeuren
                </button>
                <button className="bm-btn bm-btn-ghost bm-btn-xs" onClick={() => onDenyTeam(r)}>
                  Afwijzen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
