import { TYPES, CLAIM_WINDOW_SEC } from '../lib/constants';
import { fmt } from '../lib/helpers';

export function OfferTicket({ type, offeredAt, onClaim, onDecline }) {
  const expiresAt = offeredAt + CLAIM_WINDOW_SEC * 1000;
  const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
  const pct = Math.max(0, Math.min(100, (remaining / CLAIM_WINDOW_SEC) * 100));
  const urgent = remaining <= 60;
  const def = TYPES[type];

  return (
    <section className="t-offer-wrap">
      <div
        className={`t-ticket t-landscape t-landscape-active t-col-${type} ${urgent ? 't-ticket-urgent' : ''}`}
        onClick={() => { onClaim(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        style={{ cursor: 'pointer' }}
        title="Klik om ticket te claimen"
      >
        {type === 'short' ? (
          /* SHORT — red left body, white right stub */
          <>
            <div className="t-body-l-top">
              <div className="t-brand-l t-brand-l-inv">T-BREAK</div>
              <svg className="t-logo t-logo-l" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="white" strokeWidth="2.5" rx="1"/>
                <rect x="5" y="5" width="22" height="22" fill="white"/>
                <rect x="7" y="7" width="18" height="6" fill="var(--t-bg)"/>
                <rect x="13" y="13" width="6" height="12" fill="var(--t-bg)"/>
              </svg>
              <div className="t-type-l t-type-l-inv">{def.ticketLabel}</div>
              <div className="t-status-l t-status-l-inv">TICKET KLAAR</div>
            </div>
            <div className="t-perf-v">
              <span className="t-hole t-hole-t" />
              <span className="t-hole t-hole-b" />
            </div>
            <div className="t-stub-l t-stub-l-light">
              <div className="t-stub-l-top t-stub-l-top-dark">{urgent ? 'SNEL!' : 'CLAIMEN'}</div>
              <div className="t-stub-l-name t-stub-l-mono t-stub-l-name-dark">{fmt(remaining)}</div>
              <div className="t-stub-l-bar t-stub-l-bar-dark">
                <div className="t-stub-l-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </>
        ) : (
          /* BRB (outline) and LUNCH (solid) */
          <>
            <div className="t-body-l">
              <div className="t-brand-l">T-BREAK</div>
              {type === 'brb' ? (
              <svg className="t-logo t-logo-l" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="currentColor" strokeWidth="2.5" rx="1"/>
                <rect x="5" y="5" width="22" height="22" fill="currentColor"/>
                <rect x="7" y="7" width="18" height="6" fill="white"/>
                <rect x="13" y="13" width="6" height="12" fill="white"/>
              </svg>
              ) : (
              <svg className="t-logo t-logo-l" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="white" strokeWidth="2.5" rx="1"/>
                <rect x="5" y="5" width="22" height="22" fill="white"/>
                <rect x="7" y="7" width="18" height="6" fill="var(--t-bg)"/>
                <rect x="13" y="13" width="6" height="12" fill="var(--t-bg)"/>
              </svg>
              )}
              <div className="t-type-l">{def.useDash ? `— ${def.ticketLabel}` : def.ticketLabel}</div>
              <div className="t-status-l">TICKET KLAAR</div>
            </div>
            <div className="t-perf-v">
              <span className="t-hole t-hole-t" />
              <span className="t-hole t-hole-b" />
            </div>
            <div className="t-stub-l">
              <div className="t-stub-l-top">{urgent ? 'SNEL!' : 'CLAIMEN'}</div>
              <div className="t-stub-l-name t-stub-l-mono">{fmt(remaining)}</div>
              <div className="t-stub-l-bar">
                <div className="t-stub-l-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="t-offer-actions">
        <button className="bm-btn bm-btn-dark bm-btn-lg" onClick={() => { onClaim(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          Claim nu
        </button>
        <button className="bm-btn bm-btn-ghost" onClick={onDecline}>
          Weigeren
        </button>
      </div>
      <div className="t-offer-sub">
        {urgent ? 'Venster sluit' : 'Maak af wat je doet, dan claimen'}
      </div>
    </section>
  );
}
