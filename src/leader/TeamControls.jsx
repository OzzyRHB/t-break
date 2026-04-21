import { TEAMS, TEAM_LABELS, TEAM_COLORS, TYPES } from '../lib/constants';

export function TeamControls({ state, onUpdateConfig, onSetDefault, onLoadDefault, visible }) {
  if (!visible) return null;
  return (
    <>
      {TEAMS.map((team) => {
        const td = state.teams[team];
        const def = state.defaultConfigs?.[team];
        return (
          <div key={team} className="bm-leader-section">
            <div className="bm-team-ctrl-header">
              <span className="bm-team-ctrl-dot" style={{ background: TEAM_COLORS[team] }} />
              <h3 className="bm-leader-h3">{TEAM_LABELS[team]}</h3>
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
            </div>
            <div className="bm-default-bar">
              <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => onSetDefault(team)}>
                Sla op als standaard
              </button>
              {def && (
                <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => onLoadDefault(team)}>
                  Laad standaard
                </button>
              )}
              {def && (
                <span className="bm-default-hint">
                  BRB {def.brbPool} · Kort {def.shortPool} · Lunch {def.lunchPool}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
