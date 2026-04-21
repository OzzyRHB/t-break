import { TYPES } from '../lib/constants';
import { fmt } from '../lib/helpers';

export function ActiveTicket({ myBreak, config, onEnd }) {
  const dur = config[TYPES[myBreak.type].durKey];
  const endAt = myBreak.startedAt + dur * 1000;
  const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const pct = Math.max(0, Math.min(100, ((dur - remaining) / dur) * 100));
  const over = remaining === 0;
  const def = TYPES[myBreak.type];
  return (
    <section className="t-active-wrap">
      <div
        className={`t-ticket t-landscape t-col-${myBreak.type} ${over ? 't-ticket-over' : ''}`}
        onClick={onEnd}
        style={{ cursor: 'pointer' }}
        title="Klik om pauze te beëindigen"
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
          <div className="t-stub-l-top">ACTIEF</div>
          <div className="t-stub-l-name">{myBreak.userName}</div>
          <div className="t-stub-l-bar">
            <div className="t-stub-l-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className={`t-timer ${over ? 't-timer-over' : ''}`}>
        <div className="t-timer-val">{fmt(remaining)}</div>
        <div className="t-timer-sub">
          {over
            ? 'Tijd op — keer terug'
            : `Terug om ${new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </div>
        <button className="bm-btn bm-btn-primary bm-btn-lg" onClick={onEnd}>
          Ik ben terug
        </button>
      </div>
    </section>
  );
}
