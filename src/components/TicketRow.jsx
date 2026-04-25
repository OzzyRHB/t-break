import { TYPES, CLAIM_WINDOW_SEC } from '../lib/constants';
import { fmt } from '../lib/helpers';
import { Ticket, QueueTicket } from './Ticket';

export function TicketRow({
  type,
  state,
  me,
  myActive,
  myQueueType,
  myOffer,
  myUsage,
  myExtraBreaks = 0,
  onTake,
  onJoin,
  onLeave,
  onClaim,
  compact = false,
}) {
  const def = TYPES[type];
  const active = state.activeBreaks.filter((b) => b.type === type);
  const cap = state.config[def.poolKey];
  const queue = state.queues[type];
  // Offered slots are RESERVED — they count against availability so nobody else can take them
  const offeredCount = queue.filter((q) => q.offeredAt).length;
  const available = Math.max(0, cap - active.length - offeredCount);
  const dailyLim = def.dailyLimKey ? state.config[def.dailyLimKey] : null;
  const dailyUsed = def.dailyKey ? myUsage[def.dailyKey] || 0 : null;
  const extraAllowance = type === 'short' ? myExtraBreaks || 0 : 0;
  const effectiveDailyLim = dailyLim != null ? dailyLim + extraAllowance : null;
  const limitReached = effectiveDailyLim != null && dailyUsed >= effectiveDailyLim;

  const iAmOnAnyBreak = !!myActive;
  const iAmQueuedHere = myQueueType === type;
  const iAmQueuedElsewhere = !!myQueueType && !iAmQueuedHere;
  const myEntry = iAmQueuedHere ? queue.find((q) => q.userId === me.userId) : null;
  const hasOfferHere = !!(myEntry && myEntry.offeredAt);
  const myQPos = iAmQueuedHere ? queue.findIndex((q) => q.userId === me.userId) + 1 : null;
  const isBrb = type === 'brb';

  const showQueue = available <= 0;
  const takeDisabled = isBrb
    ? false
    : iAmOnAnyBreak || iAmQueuedElsewhere || iAmQueuedHere || limitReached;

  const queueOnClick = () => {
    if (hasOfferHere) { onClaim(); return; }
    if (iAmQueuedHere) { onLeave(); return; }
    onJoin();
  };
  const queueDisabled = isBrb
    ? false
    : iAmOnAnyBreak || iAmQueuedElsewhere || (limitReached && !iAmQueuedHere);

  let disabledReason = '';
  if (!isBrb && iAmOnAnyBreak) disabledReason = 'Je bent op pauze';
  else if (!isBrb && iAmQueuedElsewhere) disabledReason = 'Je staat al in een wachtrij';
  else if (limitReached) disabledReason = 'Daglimiet bereikt';

  // Compact view — for admin overview
  if (compact) {
    const ticketColor = def.color;
    const taken = active.length;
    const offered = offeredCount; // reserved for queue
    const avail = Math.max(0, cap - taken - offered);
    return (
      <div className="t-row-compact">
        <span className="t-row-compact-label">{def.label}</span>
        <div className="t-row-compact-squares">
          {/* Filled = available */}
          {Array.from({ length: avail }).map((_, i) => (
            <span key={`a-${i}`} className="t-compact-sq"
              style={{ background: ticketColor, borderColor: ticketColor }} />
          ))}
          {/* Dotted border = reserved/offered (queue slot) */}
          {Array.from({ length: offered }).map((_, i) => (
            <span key={`o-${i}`} className="t-compact-sq"
              style={{ background: 'transparent', borderColor: ticketColor, borderStyle: 'dashed', opacity: 0.6 }} />
          ))}
          {/* Empty = in use */}
          {Array.from({ length: taken }).map((_, i) => (
            <span key={`u-${i}`} className="t-compact-sq"
              style={{ background: 'transparent', borderColor: ticketColor + '66' }} />
          ))}
        </div>
        {queue.length > 0 && <span className="t-row-compact-queue">+{queue.length}</span>}
      </div>
    );
  }

  return (
    <section className="t-row">
      <div className="t-row-head">
        <div>
          <div className="t-row-kicker">
            {Math.round(state.config[def.durKey] / 60)} MIN · {def.tagline.toUpperCase()}
          </div>
          <h2 className="t-row-title">{def.full}</h2>
        </div>
        <div className="t-row-meta">
          {dailyLim != null && (
            <div className="t-row-stat">
              <span className="t-row-stat-num">
                {dailyUsed}
                <span className="t-row-stat-div">/</span>
                {effectiveDailyLim}
              </span>
              <span className="t-row-stat-lbl">vandaag</span>
            </div>
          )}
          <div className="t-row-stat t-row-stat-cap">
            <span className="t-row-stat-num">
              {available}
              <span className="t-row-stat-div">/</span>
              {cap}
            </span>
            <span className="t-row-stat-lbl">vrij</span>
          </div>
        </div>
      </div>

      <div className="t-row-tickets">
        {showQueue ? (
          <QueueTicket
            queueLength={queue.length}
            isMeQueued={iAmQueuedHere}
            myPosition={myQPos}
            hasOffer={hasOfferHere}
            onClick={queueOnClick}
            disabled={queueDisabled}
            disabledReason={disabledReason}
          />
        ) : (
          Array.from({ length: available }).map((_, i) => (
            <Ticket
              key={i}
              type={type}
              onClick={onTake}
              disabled={takeDisabled}
              stubTop={`#${String(i + 1).padStart(2, '0')}`}
              stubBot="TIK: NEEM"
              useDash={def.useDash}
              ticketLabel={def.ticketLabel}
            />
          ))
        )}
      </div>

      <OnBreakStrip active={active} queue={queue} config={state.config} me={me} />
    </section>
  );
}

function OnBreakStrip({ active, queue, config, me }) {
  if (active.length === 0 && queue.length === 0) return null;
  return (
    <div className="t-strip">
      {active.length > 0 && (
        <div className="t-strip-group">
          <span className="t-strip-label">Op pauze</span>
          {active.map((b) => (
            <ActiveName key={b.id} b={b} config={config} />
          ))}
        </div>
      )}
      {queue.length > 0 && (
        <div className="t-strip-group">
          <span className="t-strip-label">Wachtrij</span>
          {queue.map((q, i) => (
            <span
              key={q.userId}
              className={`t-strip-chip ${q.offeredAt ? 't-strip-chip-offer' : ''} ${
                q.userId === me.userId ? 't-strip-chip-me' : ''
              }`}
            >
              <span className="t-strip-chip-idx">{i + 1}</span>
              {q.userName}
              {q.userId === me.userId ? ' (jij)' : ''}
              {q.offeredAt && <OfferCountdownTag offeredAt={q.offeredAt} />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveName({ b, config }) {
  const dur = config[TYPES[b.type].durKey];
  const remaining = Math.max(0, Math.round((b.startedAt + dur * 1000 - Date.now()) / 1000));
  const over = remaining === 0;
  return (
    <span className={`t-strip-chip t-strip-chip-active ${over ? 't-strip-chip-over' : ''}`}>
      {b.userName}
      <span className="t-strip-chip-time">{over ? 'overrun' : fmt(remaining)}</span>
    </span>
  );
}

function OfferCountdownTag({ offeredAt }) {
  const remaining = Math.max(
    0,
    Math.round((offeredAt + CLAIM_WINDOW_SEC * 1000 - Date.now()) / 1000)
  );
  return <span className="t-strip-chip-time">{fmt(remaining)}</span>;
}
