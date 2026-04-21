import { useState } from 'react';
import { TEAMS, TEAM_LABELS, TEAM_COLORS, teamTextColor } from '../lib/constants';
import { useDarkMode } from '../hooks/useDarkMode';

export function Header({ me, onSignOut, onToggleLeader, myTeam, onRequestTeamSwitch }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useDarkMode();

  return (
    <header className="bm-header">
      <div className="bm-brand">
        <span className="bm-brand-mark">▣</span>
        <span className="bm-brand-name">T-BREAK</span>
      </div>

      {/* Employee team switcher — centered in header */}
      {!me.isLeader && (
        <div className="bm-header-team-switcher">
          {TEAMS.map((team) => {
            const isCurrent = myTeam === team;
            const color = TEAM_COLORS[team];
            return (
              <button
                key={team}
                className={`bm-header-team-pill ${isCurrent ? 'bm-header-team-pill-active' : ''}`}
                style={
                  isCurrent
                    ? { background: color, borderColor: color, color: teamTextColor(team) }
                    : { borderColor: color + '66', color: color }
                }
                onClick={() => !isCurrent && onRequestTeamSwitch(team)}
                disabled={isCurrent}
                title={isCurrent ? `Huidig team: ${TEAM_LABELS[team]}` : `Wissel naar ${TEAM_LABELS[team]}`}
              >
                {TEAM_LABELS[team]}
              </button>
            );
          })}
        </div>
      )}

      <div className="bm-header-right bm-header-actions">
        <button
          className="bm-dark-toggle"
          onClick={() => setDark((d) => !d)}
          title={dark ? 'Lichte modus' : 'Donkere modus'}
          aria-label="Schakel donkere modus"
        >
          {dark ? '☀' : '☾'}
        </button>
        <button className="bm-chip" onClick={() => setOpen((v) => !v)}>
          {me.isLeader && <span className="bm-chip-crown">♛</span>}
          <span>{me.name}</span>
        </button>
        {open && (
          <div className="bm-menu" onMouseLeave={() => setOpen(false)}>
            {me.isLeader && (
              <button
                className="bm-menu-item"
                onClick={() => {
                  onToggleLeader();
                  setOpen(false);
                }}
              >
                Medewerkerweergave
              </button>
            )}
            <button
              className="bm-menu-item"
              onClick={() => {
                onSignOut();
                setOpen(false);
              }}
            >
              Uitloggen
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
