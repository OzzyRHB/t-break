import { TEAMS, TEAM_LABELS, TEAM_COLORS, teamTextColor } from '../lib/constants';
import { fmtMs } from '../lib/helpers';

export function UsersTable({
  state,
  me,
  onGrantExtraBreak,
  onRemoveExtraBreak,
  onAssignLeader,
  onAssignTeam,
}) {
  const sessions = state.sessions || {};
  const totalTime = state.totalTime || {};
  const userIds = new Set([...Object.keys(sessions), ...Object.keys(totalTime)]);

  const usersRaw = Array.from(userIds).map((uid) => {
    const s = sessions[uid] || {};
    const t = totalTime[uid] || { brb: 0, short: 0, lunch: 0 };
    const team = s.team || t.team || null;
    const teamData = team ? state.teams[team] : null;
    const usage = teamData?.usage?.[uid] || { short: 0, lunch: 0 };
    const extra = teamData?.extraBreaks?.[uid] || 0;
    const isOnBreak = !!(team && teamData && teamData.activeBreaks.some((b) => b.userId === uid));
    const isInQueue = !!(
      team && teamData && Object.values(teamData.queues).some((q) => q.some((e) => e.userId === uid))
    );
    return {
      uid,
      name: s.name || t.name || uid.slice(0, 8),
      isLeader: s.isLeader || false,
      team,
      isOnBreak,
      isInQueue,
      extra,
      totalMs: (t.brb || 0) + (t.short || 0) + (t.lunch || 0),
      shortUsed: usage.short || 0,
      lunchUsed: usage.lunch || 0,
    };
  });

  const seenNames = new Map();
  for (const u of usersRaw) {
    if (!seenNames.has(u.name) || sessions[u.uid]) seenNames.set(u.name, u);
  }
  const users = Array.from(seenNames.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bm-leader-section">
      <h3 className="bm-leader-h3">
        Gebruikers <span className="bm-leader-h3-count">{users.length}</span>
      </h3>
      {users.length === 0 ? (
        <div className="bm-empty">Nog geen gebruikers.</div>
      ) : (
        <div className="bm-user-table">
          <div
            className="bm-user-thead"
            style={{ gridTemplateColumns: '1.2fr 110px 90px 120px 70px 200px' }}
          >
            <span>Naam</span>
            <span>Team</span>
            <span>Status</span>
            <span>Pauzes</span>
            <span>Tijd</span>
            <span>Acties</span>
          </div>
          {users.map((u) => {
            const teamData = u.team ? state.teams[u.team] : null;
            return (
              <div
                key={u.uid}
                className={`bm-user-row ${u.isOnBreak ? 'bm-user-on-break' : ''}`}
                style={{ gridTemplateColumns: '1.2fr 110px 90px 120px 70px 200px' }}
              >
                <span className="bm-user-name">
                  {u.isLeader && (
                    <span className="bm-user-crown" title="Leider">
                      ♛
                    </span>
                  )}
                  {u.name}
                  {u.uid === me.userId && <span className="bm-user-badge-you">jij</span>}
                </span>
                <span>
                  {u.team ? (
                    <span
                      className="bm-user-team-pill"
                      style={{
                        background: TEAM_COLORS[u.team],
                        color: teamTextColor(u.team),
                      }}
                    >
                      {TEAM_LABELS[u.team]}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>—</span>
                  )}
                </span>
                <span>
                  {u.isOnBreak ? (
                    <span className="bm-user-dot bm-user-dot-break">op pauze</span>
                  ) : u.isInQueue ? (
                    <span className="bm-user-dot bm-user-dot-queue">wachtrij</span>
                  ) : (
                    <span className="bm-user-dot bm-user-dot-active">actief</span>
                  )}
                </span>
                <span className="bm-user-breaks" style={{ fontSize: '11px' }}>
                  {u.shortUsed}/{(teamData?.config?.shortPerDay || 2) + u.extra} K ·{' '}
                  {u.lunchUsed}/{teamData?.config?.lunchPerDay || 1} L
                </span>
                <span className="bm-user-time">{fmtMs(u.totalMs)}</span>
                <span className="bm-user-actions">
                  <select
                    className="bm-team-select"
                    value={u.team || ''}
                    onChange={(e) => e.target.value && onAssignTeam(u.uid, u.name, e.target.value)}
                  >
                    <option value="">Team…</option>
                    {TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {TEAM_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  {u.team && (
                    <>
                      <button
                        className="bm-btn bm-btn-ghost bm-btn-xs"
                        onClick={() => onGrantExtraBreak(u.team, u.uid, u.name)}
                        title="+S"
                      >
                        +S
                      </button>
                      {u.extra > 0 && (
                        <>
                          <span className="bm-extra-badge">+{u.extra}</span>
                          <button
                            className="bm-btn bm-btn-xs bm-btn-ghost"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => onRemoveExtraBreak(u.team, u.uid, u.name)}
                            title="-S"
                          >
                            −S
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <button
                    className={`bm-btn bm-btn-xs bm-btn-crown ${
                      u.isLeader ? 'bm-btn-leader-active' : 'bm-btn-ghost'
                    }`}
                    onClick={() => onAssignLeader(u.uid, u.name, !u.isLeader)}
                    title={u.isLeader ? 'Leiderrol verwijderen' : 'Leiderrol toewijzen'}
                  >
                    ♛
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
