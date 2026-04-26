import { PRESETS, FONTS } from '../leader/TicketCustomizer';

function resolveStyle(type, ticketStyle) {
  if (!ticketStyle) return { wrapStyle: {}, isLandscape: false, preset: null };
  const preset = PRESETS.find(p => p.id === ticketStyle.preset) || PRESETS[0];
  const colors = ticketStyle[type] || {};
  const fontCss = FONTS.find(f => f.id === (ticketStyle.font || preset.font))?.css || '"Bebas Neue", sans-serif';
  const isMinimal = preset.id === 'minimal';
  return {
    preset,
    isLandscape: !!preset.landscape,
    wrapStyle: {
      '--t-bg': colors.bg,
      '--t-fg': colors.fg,
      borderRadius: preset.radius,
      boxShadow: preset.shadow === 'none' ? 'none' : preset.shadow,
      border: isMinimal ? `2px solid ${colors.fg}` : 'none',
      fontFamily: fontCss,
    },
    typeSize: preset.typeSize,
    labelSize: preset.labelSize,
    stubRatio: preset.stubRatio || 0.32,
    perf: preset.perf,
    colors,
  };
}

export function Ticket({ type, onClick, disabled, stubTop, stubBot, useDash, ticketLabel, ticketStyle }) {
  const { preset, isLandscape, wrapStyle, typeSize, labelSize, stubRatio, perf, colors } = resolveStyle(type, ticketStyle);

  if (isLandscape) {
    return (
      <button
        className={`t-ticket t-landscape t-col-${type} ${disabled ? 't-disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        style={wrapStyle}
      >
        <div className="t-body-l">
          <div className="t-brand" style={labelSize ? { fontSize: labelSize } : {}}>T-BREAK</div>
          <div className="t-type" style={typeSize ? { fontSize: typeSize } : {}}>{ticketLabel}</div>
          <div className="t-stub-l-bar"><div className="t-stub-l-bar-fill" /></div>
        </div>
        {/* Zigzag separator */}
        <div style={{ width: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
          <svg viewBox="0 0 14 200" preserveAspectRatio="none" style={{ width: 14, height: '100%' }}>
            <polyline points="0,0 14,8 0,16 14,24 0,32 14,40 0,48 14,56 0,64 14,72 0,80 14,88 0,96 14,104 0,112 14,120 0,128 14,136 0,144 14,152 0,160 14,168 0,176 14,184 0,192 14,200"
              fill="none" stroke={colors?.bg || 'var(--t-bg)'} strokeWidth="20"/>
          </svg>
        </div>
        <div className="t-stub-l">
          <div className="t-stub-l-top">{stubTop}</div>
          <div className="t-stub-l-name">{stubBot}</div>
          <div className="t-stub-l-mono">{ticketLabel}</div>
        </div>
      </button>
    );
  }

  // Portrait (default)
  const holeStyle = perf === 'none' ? { display: 'none' } : {};
  const perfLineStyle = perf === 'line' ? {
    height: 1, background: `${colors?.fg || 'currentColor'}22`, margin: '0 0', display: 'block',
  } : {};

  return (
    <button
      className={`t-ticket t-portrait t-col-${type} ${disabled ? 't-disabled' : ''} ${perf === 'dots' || perf === 'line' ? 't-notch' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={wrapStyle}
    >
      <div className="t-body">
        <div className="t-brand" style={labelSize ? { fontSize: labelSize } : {}}>T-BREAK</div>
        <div className="t-type" style={typeSize ? { fontSize: typeSize } : {}}>{useDash ? `— ${ticketLabel}` : ticketLabel}</div>
      </div>
      {perf === 'line'
        ? <div style={{ height: 1, background: `${colors?.fg || '#fff'}30`, margin: '0 10px' }} />
        : <div className="t-perf-h" style={perf === 'none' ? { visibility: 'hidden', height: 0 } : {}}>
            <span className="t-hole t-hole-l" />
            <span className="t-hole t-hole-r" />
          </div>
      }
      <div className="t-stub" style={stubRatio ? { height: `${Math.round(stubRatio * 204)}px` } : {}}>
        <div className="t-stub-top">{stubTop}</div>
        <div className="t-stub-bot">{stubBot}</div>
      </div>
    </button>
  );
}

export function QueueTicket({ queueLength, isMeQueued, myPosition, hasOffer, onClick, disabled, disabledReason, ticketStyle }) {
  const { preset, isLandscape, wrapStyle, typeSize, labelSize, stubRatio, perf, colors } = resolveStyle('brb', ticketStyle);
  // Queue ticket always uses queue colors
  const queueStyle = ticketStyle ? { ...wrapStyle, '--t-bg': 'var(--t-queue-bg)', '--t-fg': 'var(--t-queue-fg)' } : {};

  let stubTop, stubBot, hint;
  if (hasOffer)        { stubTop = '↑'; stubBot = 'CLAIM'; hint = 'ticket beschikbaar'; }
  else if (isMeQueued) { stubTop = `#${myPosition}`; stubBot = 'VERLATEN'; hint = 'in wachtrij'; }
  else                 { stubTop = String(queueLength); stubBot = 'WACHTEN'; hint = 'tik om aan te sluiten'; }

  return (
    <button
      className={`t-ticket t-portrait t-col-queue t-notch ${disabled ? 't-disabled' : ''} ${hasOffer ? 't-offer-pulse' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledReason : ''}
      style={queueStyle}
    >
      <div className="t-body">
        <div className="t-brand" style={labelSize ? { fontSize: labelSize } : {}}>T-BREAK</div>
        <div className="t-type" style={typeSize ? { fontSize: typeSize } : {}}>— QUEUE</div>
        <div className="t-hint">{hint}</div>
      </div>
      <div className="t-perf-h">
        <span className="t-hole t-hole-l" />
        <span className="t-hole t-hole-r" />
      </div>
      <div className="t-stub" style={stubRatio ? { height: `${Math.round(stubRatio * 204)}px` } : {}}>
        <div className="t-stub-top">{stubTop}</div>
        <div className="t-stub-bot">{stubBot}</div>
      </div>
    </button>
  );
}
