import { TYPES } from '../lib/constants';
import { fmt } from '../lib/helpers';

export function ActiveTicket({ myBreak, config, onEnd }) {
  const dur = config[TYPES[myBreak.type].durKey];
  const endAt = myBreak.startedAt + dur * 1000;
  const now = Date.now();
  const remaining = Math.max(0, Math.round((endAt - now) / 1000));
  const overBySec = Math.max(0, Math.round((now - endAt) / 1000));
  const pct = Math.max(0, Math.min(100, ((dur - remaining) / dur) * 100));
  const over = now >= endAt;
  const def = TYPES[myBreak.type];
  const type = myBreak.type;

  return (
    <section className="t-active-wrap" style={{ touchAction: 'manipulation' }}>
      <div
        className={`t-ticket t-landscape t-landscape-active t-col-${type} ${over ? 't-ticket-over' : ''}`}
        onClick={(e) => { e.stopPropagation(); onEnd(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        style={{ cursor: 'pointer' }}
        title="Klik om pauze te beëindigen"
      >
        {type === 'short' ? (
          /* SHORT landscape — left side red, right stub white */
          <>
            <div className="t-body-l t-body-l-top">
              <div className="t-brand-l t-brand-l-inv">T-BREAK</div>
              <div className="t-type-l t-type-l-inv">{def.ticketLabel}</div>
              <div className="t-status-l t-status-l-inv">{over ? 'OVERSCHREDEN' : 'BEZIG'}</div>
            </div>
            <div className="t-perf-v">
              <span className="t-hole t-hole-t" />
              <span className="t-hole t-hole-b" />
            </div>
            <div className="t-stub-l t-stub-l-light">
              <div className="t-stub-l-top t-stub-l-top-dark">{over ? 'OVERTIJD' : 'ACTIEF'}</div>
              <div className="t-stub-l-name t-stub-l-name-dark">{myBreak.userName}</div>
              <div className="t-stub-l-bar t-stub-l-bar-dark">
                <div className="t-stub-l-bar-fill" style={{ width: `${over ? 100 : pct}%` }} />
              </div>
            </div>
          </>
        ) : (
          /* BRB and LUNCH — unified solid/outline landscape */
          <>
            <div className="t-body-l">
              <div className="t-brand-l">T-BREAK</div>
              <div className="t-type-l">{def.useDash ? `— ${def.ticketLabel}` : def.ticketLabel}</div>
              <div className="t-status-l">{over ? 'OVERSCHREDEN' : 'BEZIG'}</div>
            </div>
            <div className="t-perf-v">
              <span className="t-hole t-hole-t" />
              <span className="t-hole t-hole-b" />
            </div>
            <div className="t-stub-l">
              <div className="t-stub-l-top">{over ? 'OVERTIJD' : 'ACTIEF'}</div>
              <div className="t-stub-l-name">{myBreak.userName}</div>
              <div className="t-stub-l-bar">
                <div className="t-stub-l-bar-fill" style={{ width: `${over ? 100 : pct}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
      <div className={`t-timer ${over ? 't-timer-over' : ''}`}>
        <div className="t-timer-val">
          {over ? `+${fmt(overBySec)}` : fmt(remaining)}
        </div>
        <div className="t-timer-sub">
          {over
            ? 'Je bent over tijd — klik de knop hieronder'
            : `Terug om ${new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </div>
        <button
          className="bm-btn bm-btn-primary bm-btn-lg"
          style={{ touchAction: 'manipulation', pointerEvents: 'auto', position: 'relative', zIndex: 20 }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEnd(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          Ik ben terug
        </button>
      </div>
    </section>
  );
}
