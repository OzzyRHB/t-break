export function Ticket({ type, onClick, disabled, stubTop, stubBot, useDash, ticketLabel }) {
  return (
    <button
      className={`t-ticket t-portrait t-col-${type} ${disabled ? 't-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="t-body">
        <div className="t-brand">T-BREAK</div>
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
    </button>
  );
}

export function QueueTicket({ queueLength, isMeQueued, myPosition, hasOffer, onClick, disabled, disabledReason }) {
  let stubTop, stubBot, hint;
  if (hasOffer) { stubTop = '↑'; stubBot = 'CLAIM HIERBOVEN'; hint = 'ticket beschikbaar'; }
  else if (isMeQueued) { stubTop = `#${myPosition}`; stubBot = 'TIK OM TE VERLATEN'; hint = 'in wachtrij'; }
  else { stubTop = String(queueLength); stubBot = 'WACHTEN'; hint = 'tik om aan te sluiten'; }
  return (
    <button
      className={`t-ticket t-portrait t-col-queue ${disabled ? 't-disabled' : ''} ${hasOffer ? 't-offer-pulse' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledReason : ''}
    >
      <div className="t-body">
        <div className="t-brand">T-BREAK</div>
        <div className="t-type">— QUEUE</div>
        <div className="t-hint">{hint}</div>
      </div>
      <div className="t-perf-h">
        <span className="t-hole t-hole-l" />
        <span className="t-hole t-hole-r" />
      </div>
      <div className="t-stub">
        <div className="t-stub-top">{stubTop}</div>
        <div className="t-stub-bot">{stubBot}</div>
      </div>
    </button>
  );
}
