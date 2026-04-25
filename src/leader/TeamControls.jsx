import { TYPES } from '../lib/constants';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';

export function TeamControls({ state, onUpdateConfig, onSetDefault, onLoadDefault, visible }) {
  if (!visible) return null;
  const teams = useTeams();
  return (
    <>
      {getTeamIds(teams).map((team) => {
        const td = state.teams[team];
        if (!td) return null; // team exists in Supabase but not in state yet — skip until next sync
        const def = state.defaultConfigs?.[team];
        const hasDefault = !!def;
        return (
          <div key={team} className="bm-leader-section">
            <div className="bm-team-ctrl-header">
              <span className="bm-team-ctrl-dot" style={{ background: getTeamColor(teams, team) }} />
              <h3 className="bm-leader-h3">{getTeamLabel(teams, team)}</h3>
            </div>
            <div className="bm-leader-grid-compact">
              {Object.keys(TYPES).map((type) => (
                <div key={type} className="bm-config-inline">
                  <span className="bm-config-label-sm">{TYPES[type].label}</span>
                  <button
                    className="bm-step-sm"
                    onClick={() =>
                      onUpdateConfig(team, {
                        [TYPES[type].poolKey]: Math.max(0, td.config[TYPES[type].poolKey] - 1),
                      })
                    }
                  >
                    −
                  </button>
                  <span className="bm-step-val-sm">{td.config[TYPES[type].poolKey]}</span>
                  <button
                    className="bm-step-sm"
                    onClick={() =>
                      onUpdateConfig(team, {
                        [TYPES[type].poolKey]: td.config[TYPES[type].poolKey] + 1,
                      })
                    }
                  >
                    +
                  </button>
                </div>
              ))}
              <button
                className="bm-cal-btn"
                onClick={() => onSetDefault(team)}
                title={hasDefault
                  ? `Huidige standaard: BRB ${def?.brbPool} · Short ${def?.shortPool} · Lunch ${def?.lunchPool} — klik om te overschrijven`
                  : 'Sla huidige instellingen op als standaard'}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 13H3a1 1 0 0 1-1-1V4l3-3h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1z"/><path d="M5 13V9h6v4"/><path d="M5 1v4h5"/></svg>
                Opslaan
              </button>
              {hasDefault && (
                <button
                  className="bm-cal-btn"
                  onClick={() => onLoadDefault(team)}
                  title={`Laad standaard: BRB ${def.brbPool} · Short ${def.shortPool} · Lunch ${def.lunchPool}`}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v9m-4-4 4 4 4-4"/></svg>
                  Laad standaard
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
