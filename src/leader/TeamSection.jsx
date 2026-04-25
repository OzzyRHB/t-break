import { useState } from 'react';
import { TYPES } from '../lib/constants';
import { useTeams, getTeamLabel, getTeamColor } from '../lib/TeamsContext';
import { TicketRow } from '../components/TicketRow';

export function TeamSection({ team, teamData, me, compact = false }) {
  const [open, setOpen] = useState(true);
  const teams = useTeams();
  if (!teamData) return null;
  return (
    <div className="bm-team-section">
      <button className="bm-team-section-header" onClick={() => setOpen((v) => !v)}>
        <span className="bm-team-section-dot" style={{ background: getTeamColor(teams, team) }} />
        <span className="bm-team-section-name">{getTeamLabel(teams, team)}</span>
        <span className="bm-team-section-arrow">{open ? '—' : '+'}</span>
      </button>
      {open && (
        <div className="bm-team-section-body" style={{ '--team-color': getTeamColor(teams, team) }}>
          {Object.keys(TYPES).map((type) => (
            <TicketRow
              key={type}
              type={type}
              state={teamData}
              me={me}
              myUsage={{}}
              myExtraBreaks={0}
              myActive={null}
              myQueueType={null}
              myOffer={null}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
