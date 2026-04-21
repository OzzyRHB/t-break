import { useState } from 'react';
import { TEAM_LABELS, TEAM_COLORS, TYPES } from '../lib/constants';
import { TicketRow } from '../components/TicketRow';

export function TeamSection({ team, teamData, me }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bm-team-section">
      <button className="bm-team-section-header" onClick={() => setOpen((v) => !v)}>
        <span className="bm-team-section-dot" style={{ background: TEAM_COLORS[team] }} />
        <span className="bm-team-section-name">{TEAM_LABELS[team]}</span>
        <span className="bm-team-section-arrow">{open ? '—' : '+'}</span>
      </button>
      {open && (
        <div className="bm-team-section-body" style={{ '--team-color': TEAM_COLORS[team] }}>
          {Object.keys(TYPES).map((type) => (
            <TicketRow
              key={type}
              type={type}
              state={teamData}
              me={me}
              myActive={null}
              myQueueType={null}
              myOffer={null}
              myUsage={{ date: '', short: 0, lunch: 0 }}
              myExtraBreaks={0}
              onTake={() => {}}
              onJoin={() => {}}
              onLeave={() => {}}
              onClaim={() => {}}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
