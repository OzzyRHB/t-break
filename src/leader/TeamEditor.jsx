import { useEffect, useRef, useState, useCallback } from 'react';
import { createTeam, updateTeam, deleteTeam, computeTextColor, useTeams } from '../lib/TeamsContext';

// ── 2D Canvas Color Picker ───────────────────────────────────────
function ColorPicker({ value, onChange }) {
  // Convert between hex, rgb, hsv
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return { r, g, b };
  };
  const rgbToHex = ({ r, g, b }) =>
    '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
  const rgbToHsv = ({ r, g, b }) => {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h=0;
    if(d){
      if(max===r) h=((g-b)/d)%6;
      else if(max===g) h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h=Math.round(h*60); if(h<0)h+=360;
    }
    return { h, s:max?Math.round(d/max*100):0, v:Math.round(max*100) };
  };
  const hsvToRgb = ({ h, s, v }) => {
    s/=100; v/=100;
    const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}
    else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    return { r:Math.round((r+m)*255), g:Math.round((g+m)*255), b:Math.round((b+m)*255) };
  };

  const initHsv = rgbToHsv(hexToRgb(value || '#d82335'));
  const [hsv, setHsv] = useState(initHsv);
  const [hexInput, setHexInput] = useState(value || '#d82335');
  const [rgbInput, setRgbInput] = useState(hexToRgb(value || '#d82335'));

  const canvasRef = useRef(null);
  const draggingSq = useRef(false);
  const draggingHue = useRef(false);

  // Draw SB square for current hue
  const drawSquare = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    // White → hue gradient (left to right)
    const hueColor = `hsl(${hsv.h},100%,50%)`;
    const gradH = ctx.createLinearGradient(0,0,w,0);
    gradH.addColorStop(0,'#fff');
    gradH.addColorStop(1,hueColor);
    ctx.fillStyle = gradH;
    ctx.fillRect(0,0,w,h);
    // Transparent → black (top to bottom)
    const gradV = ctx.createLinearGradient(0,0,0,h);
    gradV.addColorStop(0,'rgba(0,0,0,0)');
    gradV.addColorStop(1,'#000');
    ctx.fillStyle = gradV;
    ctx.fillRect(0,0,w,h);
  }, [hsv.h]);

  useEffect(() => { drawSquare(); }, [drawSquare]);

  const pickFromSquare = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width,  (e.clientX - rect.left) * (canvas.width  / rect.width)));
    const y = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top)  * (canvas.height / rect.height)));
    const s = Math.round(x / canvas.width * 100);
    const v = Math.round((1 - y / canvas.height) * 100);
    applyHsv({ ...hsv, s, v });
  };

  const applyHsv = (newHsv) => {
    setHsv(newHsv);
    const rgb = hsvToRgb(newHsv);
    setRgbInput(rgb);
    const hex = rgbToHex(rgb);
    setHexInput(hex);
    onChange(hex);
  };

  const handleHueBar = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const h = Math.round(x / rect.width * 360);
    applyHsv({ ...hsv, h });
  };

  const handleRgb = (ch, val) => {
    const n = Math.max(0, Math.min(255, parseInt(val)||0));
    const newRgb = { ...rgbInput, [ch]: n };
    setRgbInput(newRgb);
    const newHsv = rgbToHsv(newRgb);
    setHsv(newHsv);
    const hex = rgbToHex(newRgb);
    setHexInput(hex);
    onChange(hex);
  };

  const handleHex = (v) => {
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const rgb = hexToRgb(v);
      setRgbInput(rgb);
      const newHsv = rgbToHsv(rgb);
      setHsv(newHsv);
      onChange(v);
    }
  };

  // Cursor position on square
  const cursorX = `${hsv.s}%`;
  const cursorY = `${100 - hsv.v}%`;
  // Hue thumb position
  const hueX = `${hsv.h / 360 * 100}%`;

  const currentHex = rgbToHex(hsvToRgb(hsv));
  const textColor = computeTextColor(currentHex);

  return (
    <div className="bm-cp2">
      {/* 2D Square */}
      <div className="bm-cp2-sq-wrap"
        onMouseDown={e => { draggingSq.current=true; pickFromSquare(e); }}
        onMouseMove={e => { if(draggingSq.current) pickFromSquare(e); }}
        onMouseUp={() => { draggingSq.current=false; }}
        onMouseLeave={() => { draggingSq.current=false; }}
      >
        <canvas ref={canvasRef} className="bm-cp2-sq" width={260} height={180} />
        <div className="bm-cp2-cursor" style={{ left: cursorX, top: cursorY }} />
      </div>

      {/* Hue bar */}
      <div className="bm-cp2-hue-wrap"
        onMouseDown={e => { draggingHue.current=true; handleHueBar(e); }}
        onMouseMove={e => { if(draggingHue.current) handleHueBar(e); }}
        onMouseUp={() => { draggingHue.current=false; }}
        onMouseLeave={() => { draggingHue.current=false; }}
      >
        <div className="bm-cp2-hue" />
        <div className="bm-cp2-hue-thumb" style={{ left: hueX }} />
      </div>

      {/* Fields row: HSV + RGB + HEX */}
      <div className="bm-cp2-fields">
        <div className="bm-cp2-field-group">
          <label className="bm-cp2-field-lbl">H</label>
          <input className="bm-cp2-field-input" type="number" min="0" max="360"
            value={hsv.h} onChange={e => applyHsv({...hsv, h: Math.max(0,Math.min(360,+e.target.value))})} />
        </div>
        <div className="bm-cp2-field-group">
          <label className="bm-cp2-field-lbl">S</label>
          <input className="bm-cp2-field-input" type="number" min="0" max="100"
            value={hsv.s} onChange={e => applyHsv({...hsv, s: Math.max(0,Math.min(100,+e.target.value))})} />
        </div>
        <div className="bm-cp2-field-group">
          <label className="bm-cp2-field-lbl">B</label>
          <input className="bm-cp2-field-input" type="number" min="0" max="100"
            value={hsv.v} onChange={e => applyHsv({...hsv, v: Math.max(0,Math.min(100,+e.target.value))})} />
        </div>
        <div className="bm-cp2-divider" />
        <div className="bm-cp2-field-group">
          <label className="bm-cp2-field-lbl">R</label>
          <input className="bm-cp2-field-input" type="number" min="0" max="255"
            value={rgbInput.r} onChange={e => handleRgb('r', e.target.value)} />
        </div>
        <div className="bm-cp2-field-group">
          <label className="bm-cp2-field-lbl">G</label>
          <input className="bm-cp2-field-input" type="number" min="0" max="255"
            value={rgbInput.g} onChange={e => handleRgb('g', e.target.value)} />
        </div>
        <div className="bm-cp2-field-group">
          <label className="bm-cp2-field-lbl">B</label>
          <input className="bm-cp2-field-input" type="number" min="0" max="255"
            value={rgbInput.b} onChange={e => handleRgb('b', e.target.value)} />
        </div>
        <div className="bm-cp2-divider" />
        <div className="bm-cp2-field-group bm-cp2-field-hex">
          <label className="bm-cp2-field-lbl">#</label>
          <input className="bm-cp2-field-input" type="text" maxLength={7}
            value={hexInput} onChange={e => handleHex(e.target.value)}
            spellCheck={false} placeholder="d82335" />
        </div>
        {/* Preview swatch */}
        <div className="bm-cp2-preview" style={{ background: currentHex }} title={currentHex} />
      </div>
    </div>
  );
}

// ── Single team row ──────────────────────────────────────────────
function TeamRow({ team, state, notify }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(team.label);
  const [color, setColor] = useState(team.color);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!label.trim()) { notify('Naam mag niet leeg zijn', 'warn'); return; }
    setBusy(true);
    try {
      await updateTeam(team.id, { label: label.trim(), color });
      notify(`Team "${label.trim()}" bijgewerkt`, 'ok');
      setEditing(false);
    } catch (e) { notify('Fout: ' + e.message, 'warn'); }
    setBusy(false);
  };

  const del = async () => {
    setBusy(true);
    try {
      await deleteTeam(team.id);
      notify(`Team "${team.label}" verwijderd`, 'ok');
    } catch (e) { notify('Kan niet verwijderen: ' + e.message, 'warn'); }
    setBusy(false); setConfirmDelete(false);
  };

  const memberCount = Object.values(state?.sessions || {})
    .filter(s => s.team === team.id && Date.now() - (s.lastSeen || 0) < 15 * 60 * 1000).length;

  return (
    <div className="bm-te-row">
      <div className="bm-te-swatch" style={{ background: team.color }} />
      {!editing ? (
        <>
          <div className="bm-te-info">
            <span className="bm-te-label">{team.label}</span>
            {memberCount > 0 && <span className="bm-te-members">{memberCount} online</span>}
          </div>
          <button className="bm-te-edit-btn" onClick={() => setEditing(true)} title="Team bewerken">✏️</button>
        </>
      ) : (
        <div className="bm-te-edit">
          <input className="bm-input bm-te-name-input"
            value={label} onChange={e => setLabel(e.target.value)} placeholder="Teamnaam" autoFocus />
          <ColorPicker value={color} onChange={setColor} />
          <div className="bm-te-edit-actions">
            <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button className="bm-btn bm-btn-ghost bm-btn-sm"
              onClick={() => { setEditing(false); setLabel(team.label); setColor(team.color); setConfirmDelete(false); }}>
              Annuleren
            </button>
            {confirmDelete ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>Zeker weten?</span>
                <button className="bm-btn bm-btn-sm"
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={del} disabled={busy}>Ja, verwijder</button>
                <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setConfirmDelete(false)}>Nee</button>
              </>
            ) : (
              <button className="bm-btn bm-btn-ghost bm-btn-sm"
                style={{ color: memberCount > 0 ? 'var(--ink-3)' : 'var(--danger)' }}
                onClick={() => setConfirmDelete(true)} disabled={busy}>🗑 Verwijder</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────
export function TeamEditor({ state, onClose, notify }) {
  const teams = useTeams();
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#d82335');
  const [addBusy, setAddBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const addTeam = async () => {
    if (!newLabel.trim()) { notify('Naam is verplicht', 'warn'); return; }
    setAddBusy(true);
    try {
      await createTeam({ label: newLabel.trim(), color: newColor });
      notify(`Team "${newLabel.trim()}" aangemaakt`, 'ok');
      setNewLabel(''); setNewColor('#d82335'); setShowAdd(false);
    } catch (e) { notify('Fout: ' + e.message, 'warn'); }
    setAddBusy(false);
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup bm-te-modal" onClick={e => e.stopPropagation()}>
        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">Teams beheren</div>
            <div className="bm-modal-sub">Klik op ✏️ om te bewerken</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="bm-te-list">
          {teams.map(t => (
            <TeamRow key={t.id} team={t} state={state} notify={notify} />
          ))}
        </div>

        <div className="bm-te-footer">
          {showAdd ? (
            <div className="bm-te-new">
              <input className="bm-input bm-te-name-input"
                value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="Teamnaam" autoFocus />
              <ColorPicker value={newColor} onChange={setNewColor} />
              <div className="bm-te-edit-actions">
                <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={addTeam} disabled={addBusy}>
                  {addBusy ? 'Aanmaken…' : '+ Aanmaken'}
                </button>
                <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setShowAdd(false)}>Annuleren</button>
              </div>
            </div>
          ) : (
            <button className="bm-btn bm-btn-primary bm-te-add-btn" onClick={() => setShowAdd(true)}>
              + Nieuw team
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { TeamEditor as TeamEditorModal };
