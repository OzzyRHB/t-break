import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ── Available fonts ─────────────────────────────────────────────
export const FONTS = [
  { id: 'Bebas Neue',  label: 'Bebas Neue',   css: '"Bebas Neue", sans-serif' },
  { id: 'Fraunces',   label: 'Fraunces',      css: 'Fraunces, serif' },
  { id: 'Geist Mono', label: 'Geist Mono',    css: '"Geist Mono", monospace' },
  { id: 'Geist',      label: 'Geist',         css: 'Geist, sans-serif' },
];

// ── Presets ─────────────────────────────────────────────────────
// Each preset defines shape, perf, shadow, font, sizing, and border style
export const PRESETS = [
  {
    id: 'cinema',
    name: '🎬 Cinema',
    desc: 'Klassiek bioscoopticket met geperforeerde rand',
    radius: 10, perf: 'dots', labelSize: 11, typeSize: 38,
    font: 'Bebas Neue', stubRatio: 0.32,
    shadow: '0 6px 24px rgba(0,0,0,0.22)',
    border: 'none', outline: 'none',
  },
  {
    id: 'boarding',
    name: '✈️ Boarding Pass',
    desc: 'Instapkaart met zigzag scheidingslijn',
    radius: 6, perf: 'zigzag', labelSize: 9, typeSize: 26,
    font: 'Geist Mono', stubRatio: 0.38,
    shadow: '0 2px 12px rgba(0,0,0,0.13)',
    border: 'none', outline: 'none', landscape: true,
  },
  {
    id: 'minimal',
    name: '◻ Minimal',
    desc: 'Strak, plat, geen perforation',
    radius: 3, perf: 'line', labelSize: 10, typeSize: 30,
    font: 'Geist', stubRatio: 0.26,
    shadow: 'none',
    border: '2px solid', outline: 'outline',
  },
  {
    id: 'retro',
    name: '🎪 Retro',
    desc: 'Vintage festivalticket, grote type, inner glow',
    radius: 18, perf: 'dots', labelSize: 12, typeSize: 46,
    font: 'Bebas Neue', stubRatio: 0.36,
    shadow: '0 10px 30px rgba(0,0,0,0.25), inset 0 0 0 2.5px rgba(255,255,255,0.18)',
    border: 'none', outline: 'none',
  },
  {
    id: 'card',
    name: '💳 Card',
    desc: 'Creditcard — afgerond, groot lettertype',
    radius: 22, perf: 'none', labelSize: 9, typeSize: 28,
    font: 'Fraunces', stubRatio: 0.30,
    shadow: '0 14px 40px rgba(0,0,0,0.2)',
    border: 'none', outline: 'none',
  },
];

const STORAGE_KEY = 'tbreak-ticket-style-v2';

export async function loadTicketStyle() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function saveTicketStyle(style) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(style)); } catch {}
}

const cinemaPreset = PRESETS[0];
export const DEFAULT_TICKET_STYLE = {
  preset: 'cinema',
  font: cinemaPreset.font,
  brb:   { bg: '#08AD8B', fg: '#ffffff' },
  short: { bg: '#fff6eb', fg: '#b93a39' },
  lunch: { bg: '#b93a39', fg: '#ffffff' },
  ...cinemaPreset,
};

// ── Color picker ─────────────────────────────────────────────────
function ColorPicker({ label, value, onChange }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const update = (v) => { setHex(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v); };
  return (
    <div className="btc-color-row">
      <span className="btc-color-label">{label}</span>
      <input type="color" value={hex.length === 7 ? hex : '#000000'}
        onChange={e => update(e.target.value)} className="btc-color-input" />
      <input type="text" value={hex} maxLength={7}
        onChange={e => { if (/^#?[0-9a-fA-F]{0,6}$/.test(e.target.value)) update(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value); }}
        className="btc-hex-input" />
    </div>
  );
}

// ── Preview ticket — self-contained, fully inline styles ─────────
function PreviewTicket({ type, style }) {
  const preset = PRESETS.find(p => p.id === style.preset) || PRESETS[0];
  const colors = style[type] || style.brb || { bg: '#08AD8B', fg: '#fff' };
  const fontCss = FONTS.find(f => f.id === (style.font || preset.font))?.css || '"Bebas Neue", sans-serif';
  const typeLabels = { brb: 'BRB', short: '— BREAK', lunch: 'LUNCH' };
  const durations  = { brb: '3 MIN', short: '15 MIN', lunch: '30 MIN' };
  const isLandscape = preset.landscape;
  const isMinimal = preset.id === 'minimal';
  const borderStr = isMinimal ? `2px solid ${colors.fg}` : 'none';

  const wrapStyle = {
    display: 'flex',
    flexDirection: isLandscape ? 'row' : 'column',
    background: colors.bg,
    color: colors.fg,
    fontFamily: fontCss,
    borderRadius: preset.radius,
    boxShadow: preset.shadow === 'none' ? 'none' : preset.shadow,
    border: borderStr,
    width: isLandscape ? 230 : 128,
    minHeight: isLandscape ? 90 : 210,
    overflow: 'hidden',
    userSelect: 'none',
    transition: 'all 0.2s',
  };

  const bodyStyle = {
    flex: 1, padding: isLandscape ? '14px 18px' : '16px 14px 10px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  };

  const perfColor = isMinimal ? `${colors.fg}22` : 'var(--bg, #f5f5f5)';

  // Perforation between body and stub
  const PerfLine = () => {
    if (preset.perf === 'none') return null;
    if (preset.perf === 'line') return (
      <div style={{ [isLandscape?'width':'height']: 1, background: `${colors.fg}30`, flexShrink: 0 }} />
    );
    if (preset.perf === 'zigzag') return (
      <div style={{ [isLandscape?'width':'height']: 14, flexShrink: 0, display:'flex',
        flexDirection: isLandscape ? 'column' : 'row', alignItems: 'center', overflow: 'hidden' }}>
        <svg viewBox="0 0 14 100" preserveAspectRatio="none"
          style={{ width: isLandscape ? 14 : '100%', height: isLandscape ? '100%' : 14 }}>
          <polyline points="0,0 14,8 0,16 14,24 0,32 14,40 0,48 14,56 0,64 14,72 0,80 14,88 0,96 14,100"
            fill="none" stroke={colors.bg} strokeWidth="20"/>
        </svg>
      </div>
    );
    // dots
    return (
      <div style={{ [isLandscape?'width':'height']: 12, flexShrink: 0,
        display: 'flex', flexDirection: isLandscape ? 'column' : 'row',
        alignItems: 'center', justifyContent: 'space-around', padding: isLandscape ? '4px 0' : '0 6px' }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width:10,height:10,borderRadius:'50%',background:perfColor,flexShrink:0 }}/>)}
      </div>
    );
  };

  const stubStyle = isLandscape
    ? { width: 72, borderLeft: `1.5px dashed ${colors.fg}40`, padding: '12px 10px',
        display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:3 }
    : { borderTop: `1.5px dashed ${colors.fg}40`, padding: '8px 14px',
        display:'flex',flexDirection:'column',justifyContent:'center' };

  return (
    <div style={wrapStyle}>
      <div style={bodyStyle}>
        <div style={{ fontSize: preset.labelSize, letterSpacing:'0.22em', opacity:0.7, textTransform:'uppercase' }}>T-BREAK</div>
        {isLandscape && (
          <div style={{ fontSize: 8, opacity:0.55, letterSpacing:'0.14em', textTransform:'uppercase', marginTop:2 }}>Break Ticket</div>
        )}
        <div style={{ fontSize: preset.typeSize, lineHeight:0.9, letterSpacing:'0.02em', marginTop:8 }}>
          {typeLabels[type]}
        </div>
        {isLandscape
          ? <div style={{marginTop:8}}>
              <div style={{fontSize:8,opacity:0.5,letterSpacing:'0.14em'}}>DUUR</div>
              <div style={{fontSize:14,letterSpacing:'0.08em'}}>{durations[type]}</div>
            </div>
          : <div style={{fontSize:8,letterSpacing:'0.1em',opacity:0.6,marginTop:6,textTransform:'uppercase'}}>Tik om te nemen</div>
        }
      </div>
      <PerfLine />
      <div style={stubStyle}>
        <div style={{fontSize:22,lineHeight:1,letterSpacing:'0.04em'}}>#01</div>
        <div style={{fontSize:7,letterSpacing:'0.14em',opacity:0.65,marginTop:2,textTransform:'uppercase'}}>NEEM</div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────
export function TicketCustomizerModal({ onClose, onApply, currentStyle }) {
  const [style, setStyle] = useState({ ...DEFAULT_TICKET_STYLE, ...currentStyle });
  const [tab, setTab] = useState('brb');

  const preset = PRESETS.find(p => p.id === style.preset) || PRESETS[0];

  const applyPreset = (p) => setStyle(s => ({ ...s, preset: p.id, font: p.font, ...p, typeSize: p.typeSize, labelSize: p.labelSize }));
  const setColor = (type, key, val) => setStyle(s => ({ ...s, [type]: { ...s[type], [key]: val } }));
  const setFont = (f) => setStyle(s => ({ ...s, font: f }));
  const setTypeSize = (v) => setStyle(s => ({ ...s, typeSize: Number(v) }));
  const setLabelSize = (v) => setStyle(s => ({ ...s, labelSize: Number(v) }));

  const handleApply = () => { saveTicketStyle(style); onApply(style); onClose(); };

  return createPortal(
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup btc-modal" onClick={e => e.stopPropagation()}>

        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">Ticket stijl</div>
            <div className="bm-modal-sub">Pas het uiterlijk aan voor alle medewerkers</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="btc-body">
          {/* ── Left: controls ── */}
          <div className="btc-controls">

            {/* Presets */}
            <div className="btc-section-label">Stijl preset</div>
            <div className="btc-presets">
              {PRESETS.map(p => (
                <button key={p.id}
                  className={`btc-preset-btn ${style.preset === p.id ? 'btc-preset-active' : ''}`}
                  onClick={() => applyPreset(p)} title={p.desc}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="btc-preset-desc">{preset.desc}</div>

            {/* Font picker */}
            <div className="btc-section-label" style={{marginTop:8}}>Lettertype</div>
            <div className="btc-font-grid">
              {FONTS.map(f => (
                <button key={f.id}
                  className={`btc-font-btn ${style.font === f.id ? 'btc-font-active' : ''}`}
                  style={{ fontFamily: f.css }}
                  onClick={() => setFont(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Font size sliders */}
            <div className="btc-section-label" style={{marginTop:8}}>Lettergrootte</div>
            <div className="btc-size-row">
              <span className="btc-size-label">Type</span>
              <input type="range" min={16} max={72} step={1}
                value={style.typeSize || preset.typeSize}
                onChange={e => setTypeSize(e.target.value)}
                className="btc-size-slider" />
              <span className="btc-size-val">{style.typeSize || preset.typeSize}px</span>
            </div>
            <div className="btc-size-row">
              <span className="btc-size-label">Label</span>
              <input type="range" min={7} max={18} step={1}
                value={style.labelSize || preset.labelSize}
                onChange={e => setLabelSize(e.target.value)}
                className="btc-size-slider" />
              <span className="btc-size-val">{style.labelSize || preset.labelSize}px</span>
            </div>

            {/* Color pickers */}
            <div className="btc-section-label" style={{marginTop:8}}>Kleuren</div>
            <div className="btc-color-tabs">
              {['brb','short','lunch'].map(t => (
                <button key={t}
                  className={`btc-color-tab ${tab===t?'btc-color-tab-active':''}`}
                  style={{ '--dot': style[t]?.bg }}
                  onClick={() => setTab(t)}>
                  <span className="btc-tab-dot" />
                  {t==='brb'?'BRB':t==='short'?'Short':'Lunch'}
                </button>
              ))}
            </div>
            <div className="btc-color-fields">
              <ColorPicker label="Achtergrond" value={style[tab]?.bg||'#000'} onChange={v=>setColor(tab,'bg',v)} />
              <ColorPicker label="Tekst" value={style[tab]?.fg||'#fff'} onChange={v=>setColor(tab,'fg',v)} />
            </div>
          </div>

          {/* ── Right: preview ── */}
          <div className="btc-preview-panel">
            <div className="btc-section-label">Live voorbeeld</div>
            <div className="btc-type-tabs">
              {['brb','short','lunch'].map(t => (
                <button key={t}
                  className={`btc-type-tab ${tab===t?'btc-type-tab-active':''}`}
                  onClick={() => setTab(t)}>
                  {t==='brb'?'BRB':t==='short'?'Short':'Lunch'}
                </button>
              ))}
            </div>
            <div className="btc-preview-wrap">
              <PreviewTicket type={tab} style={style} />
            </div>
          </div>
        </div>

        <div className="btc-footer">
          <button className="bm-btn bm-btn-primary" onClick={handleApply}>✓ Toepassen</button>
          <button className="bm-btn bm-btn-ghost" onClick={onClose}>Annuleren</button>
          <button className="bm-btn bm-btn-ghost btc-reset-btn"
            onClick={() => setStyle({...DEFAULT_TICKET_STYLE})}>
            ↺ Standaard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
