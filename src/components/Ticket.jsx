export function Ticket({ type, onClick, disabled, stubTop, stubBot, useDash, ticketLabel }) {
  const scroll = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <button
      className={`t-ticket t-portrait t-col-${type} ${disabled ? 't-disabled' : ''}`}
      onClick={disabled ? undefined : () => { onClick(); scroll(); }}
      disabled={disabled}
    >
      {type === 'short' ? (
        /* SHORT — split: red top, cream bottom */
        <>
          <div className="t-body t-body-top">
            <div className="t-brand t-brand-inv">T-BREAK</div>
            <svg className="t-logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="white" strokeWidth="2.5" rx="1"/>
            <rect x="5" y="5" width="22" height="22" fill="white"/>
            <rect x="7" y="7" width="18" height="6" fill="currentColor"/>
            <rect x="13" y="13" width="6" height="12" fill="currentColor"/>
          </svg>
          </div>
          <div className="t-perf-h t-perf-h-split">
            <span className="t-hole t-hole-l" />
            <span className="t-hole t-hole-r" />
          </div>
          <div className="t-body t-body-bot">
            <div className="t-type t-type-dark">{ticketLabel}</div>
            <div className="t-stub t-stub-inline">
              <div className="t-stub-top t-stub-top-dark">{stubTop}</div>
              <div className="t-stub-bot t-stub-bot-dark">{stubBot}</div>
            </div>
          </div>
        </>
      ) : (
        /* BRB (outline) and LUNCH (solid) */
        <>
          <div className="t-body">
            <div className="t-brand">T-BREAK</div>
            <svg className="t-logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="currentColor" strokeWidth="2.5" rx="1"/>
          <rect x="5" y="5" width="22" height="22" fill="currentColor"/>
          <rect x="7" y="7" width="18" height="6" fill="white"/>
          <rect x="13" y="13" width="6" height="12" fill="white"/>
        </svg>
            <div className="t-type">{useDash ? `— ${ticketLabel}` : ticketLabel}</div>
          </div>
          <div className="t-perf-h">
            <span className="t-hole t-hole-l" />
            <span className="t-hole t-hole-r" />
          </div>
          <div className="t-stub">
            <div className="t-stub-top">{stubTop}</div>
            <div className="t-stub-bot">{stubBot}</div>
          </div>
        </>
      )}
    </button>
  );
}

export function QueueTicket({ queueLength, isMeQueued, myPosition, hasOffer, onClick, disabled, disabledReason }) {
  let stubTop, stubBot, hint;
  if (hasOffer) { stubTop = '↑'; stubBot = 'CLAIM HIERBOVEN'; hint = 'ticket beschikbaar'; }
  else if (isMeQueued) { stubTop = `#${myPosition}`; stubBot = 'TIK OM TE VERLATEN'; hint = 'in wachtrij'; }
  else { stubTop = String(queueLength); stubBot = 'WACHTEN'; hint = 'tik om aan te sluiten'; }

  const scroll = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      className={`t-ticket t-portrait t-col-queue ${disabled ? 't-disabled' : ''} ${hasOffer ? 't-offer-pulse' : ''}`}
      onClick={disabled ? undefined : () => { onClick(); scroll(); }}
      disabled={disabled}
      title={disabled ? disabledReason : ''}
    >
      {/* QUEUE — split: green top, white bottom */}
      <div className="t-body t-body-top t-body-top-queue">
        <div className="t-brand t-brand-inv">T-BREAK</div>
        <svg className="t-logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="31" height="31" fill="none" stroke="white" strokeWidth="2.5" rx="1"/>
        <rect x="5" y="5" width="22" height="22" fill="white"/>
        <rect x="7" y="7" width="18" height="6" fill="currentColor"/>
        <rect x="13" y="13" width="6" height="12" fill="currentColor"/>
          </svg>
      </div>
      <div className="t-perf-h t-perf-h-split t-perf-h-queue">
        <span className="t-hole t-hole-l" />
        <span className="t-hole t-hole-r" />
      </div>
      <div className="t-body t-body-bot t-body-bot-queue">
        <div className="t-hint t-hint-queue">{hint}</div>
        <div className="t-stub t-stub-inline">
          <div className="t-stub-top t-stub-top-queue">{stubTop}</div>
          <div className="t-stub-bot t-stub-bot-queue">{stubBot}</div>
        </div>
      </div>
    </button>
  );
}
