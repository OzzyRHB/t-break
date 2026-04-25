import { TYPES } from '../lib/constants';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';

export function TeamControls({ state, onUpdateConfig, onSetDefault, onLoadDefault, visible }) {
  if (!visible) return null;
  const teams = useTeams();
  return (
    <>
      {getTeamIds(teams).map((team) => {
        const td = state.teams[team];
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
                className={`bm-save-default-btn ${hasDefault ? 'bm-saved' : ''}`}
                onClick={() => onSetDefault(team)}
                title={hasDefault
                  ? `Huidige standaard: BRB ${def.brbPool} · Short ${def.shortPool} · Lunch ${def.lunchPool} — klik om te overschrijven`
                  : 'Sla huidige instellingen op als standaard'}
              >
                💾
              </button>
              {hasDefault && (
                <button
                  className="bm-btn bm-btn-ghost bm-btn-sm"
                  onClick={() => onLoadDefault(team)}
                  title={`Laad standaard: BRB ${def.brbPool} · Short ${def.shortPool} · Lunch ${def.lunchPool}`}
                >
                  ↺ Laad standaard
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
