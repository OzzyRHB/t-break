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

  return (
    <section className="t-active-wrap" style={{ touchAction: 'manipulation' }}>
      <div
        className={`t-ticket t-landscape t-col-${myBreak.type} ${over ? 't-ticket-over' : ''}`}
        onClick={over ? undefined : onEnd}
        style={{ cursor: over ? 'default' : 'pointer', pointerEvents: over ? 'none' : 'auto' }}
        title={over ? '' : 'Klik om pauze te beëindigen'}
      >
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
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEnd(); }}
        >
          Ik ben terug
        </button>
      </div>
    </section>
  );
}
