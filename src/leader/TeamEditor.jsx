import { useEffect, useRef, useState } from 'react';
import { createTeam, updateTeam, deleteTeam, computeTextColor, useTeams } from '../lib/TeamsContext';

// ── Tiny HSL color picker ────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  // Parse hex → hsl
  const hexToHsl = (hex) => {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}else{
      const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}
    }
    return [Math.round(h*360),Math.round(s*100),Math.round(l*100)];
  };
  const hslToHex = (h,s,l) => {
    s/=100; l/=100;
    const k=n=>(n+h/30)%12;
    const a=s*Math.min(l,1-l);
    const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
    return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
  };

  const [hsl, setHsl] = useState(() => hexToHsl(value || '#08AD8B'));
  const [hex, setHex] = useState(value || '#08AD8B');

  const updateHsl = (i, v) => {
    const next = [...hsl]; next[i] = v; setHsl(next);
    const h = hslToHex(...next);
    setHex(h); onChange(h);
  };
  const updateHex = (v) => {
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      setHsl(hexToHsl(v)); onChange(v);
    }
  };

  const SWATCHES = [
    '#b93a39','#08AD8B','#ffcc00','#3b82f6','#8b5cf6',
    '#f97316','#14b8a6','#e11d48','#10b981','#6366f1',
  ];

  const preview = computeTextColor(hex);

  return (
    <div className="bm-color-picker">
      {/* Preview swatch */}
      <div className="bm-color-preview" style={{ background: hex, color: preview }}>
        Aa
      </div>

      {/* Preset swatches */}
      <div className="bm-color-swatches">
        {SWATCHES.map(s => (
          <button key={s} className={`bm-color-swatch ${hex.toLowerCase()===s?'bm-color-swatch-active':''}`}
            style={{ background: s }}
            onClick={() => { setHex(s); setHsl(hexToHsl(s)); onChange(s); }}
            title={s}
          />
        ))}
      </div>

      {/* HSL sliders */}
      <div className="bm-color-sliders">
        <label className="bm-color-slider-row">
          <span>H</span>
          <input type="range" min="0" max="359" value={hsl[0]}
            onChange={e => updateHsl(0, +e.target.value)}
            style={{ '--thumb': hslToHex(hsl[0], 100, 50) }}
            className="bm-slider bm-slider-hue"
          />
          <span className="bm-slider-val">{hsl[0]}°</span>
        </label>
        <label className="bm-color-slider-row">
          <span>S</span>
          <input type="range" min="0" max="100" value={hsl[1]}
            onChange={e => updateHsl(1, +e.target.value)}
            className="bm-slider"
          />
          <span className="bm-slider-val">{hsl[1]}%</span>
        </label>
        <label className="bm-color-slider-row">
          <span>L</span>
          <input type="range" min="10" max="90" value={hsl[2]}
            onChange={e => updateHsl(2, +e.target.value)}
            className="bm-slider"
          />
          <span className="bm-slider-val">{hsl[2]}%</span>
        </label>
      </div>

      {/* Hex input */}
      <div className="bm-color-hex-row">
        <span>HEX</span>
        <input className="bm-input bm-color-hex-input"
          value={hex} onChange={e => updateHex(e.target.value)}
          placeholder="#000000" maxLength={7}
        />
      </div>
    </div>
  );
}

// ── Single team edit row ─────────────────────────────────────────
function TeamRow({ team, state, onSaved, onDeleted, notify }) {
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
      onSaved?.();
    } catch (e) { notify('Fout: ' + e.message, 'warn'); }
    setBusy(false);
  };

  const del = async () => {
    setBusy(true);
    try {
      await deleteTeam(team.id);
      notify(`Team "${team.label}" verwijderd`, 'ok');
      onDeleted?.();
    } catch (e) { notify('Kan niet verwijderen: ' + e.message, 'warn'); }
    setBusy(false);
    setConfirmDelete(false);
  };

  // Check if team has active members in current state
  const memberCount = Object.values(state?.sessions || {})
    .filter(s => s.team === team.id && Date.now() - (s.lastSeen || 0) < 15 * 60 * 1000).length;

  return (
    <div className="bm-te-row">
      <div
        className="bm-te-swatch"
        style={{ background: team.color }}
        onClick={() => setEditing(v => !v)}
        title="Klik om te bewerken"
      />
      {editing ? (
        <div className="bm-te-edit">
          <input className="bm-input bm-te-name-input"
            value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Teamnaam"
          />
          <ColorPicker value={color} onChange={setColor} />
          <div className="bm-te-edit-actions">
            <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => { setEditing(false); setLabel(team.label); setColor(team.color); }}>
              Annuleren
            </button>
            {confirmDelete ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>Zeker weten?</span>
                <button className="bm-btn bm-btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={del} disabled={busy}>
                  Ja, verwijder
                </button>
                <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setConfirmDelete(false)}>Nee</button>
              </>
            ) : (
              <button
                className="bm-btn bm-btn-ghost bm-btn-sm"
                style={{ color: memberCount > 0 ? 'var(--ink-3)' : 'var(--danger)' }}
                title={memberCount > 0 ? `${memberCount} actieve medewerker(s) — kan niet verwijderen` : 'Verwijder team'}
                disabled={memberCount > 0 || busy}
                onClick={() => setConfirmDelete(true)}
              >
                🗑 Verwijder
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bm-te-info" onClick={() => setEditing(true)}>
          <span className="bm-te-label">{team.label}</span>
          {memberCount > 0 && <span className="bm-te-members">{memberCount} online</span>}
          <span className="bm-te-hex">{team.color}</span>
        </div>
      )}
    </div>
  );
}

// ── New team form ────────────────────────────────────────────────
function NewTeamForm({ onCreated, notify }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!label.trim()) { notify('Vul een naam in', 'warn'); return; }
    setBusy(true);
    try {
      await createTeam({ label: label.trim(), color });
      notify(`Team "${label.trim()}" aangemaakt`, 'ok');
      setLabel(''); setColor('#3b82f6'); setOpen(false);
      onCreated?.();
    } catch (e) { notify('Fout: ' + e.message, 'warn'); }
    setBusy(false);
  };

  if (!open) return (
    <button className="bm-cal-btn" style={{ margin: '4px 0 0' }} onClick={() => setOpen(true)}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
      Nieuw team
    </button>
  );

  return (
    <div className="bm-te-new">
      <input className="bm-input bm-te-name-input"
        value={label} onChange={e => setLabel(e.target.value)}
        placeholder="Naam nieuw team" autoFocus
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="bm-te-edit-actions">
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={save} disabled={busy}>
          {busy ? 'Aanmaken…' : 'Aanmaken'}
        </button>
        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setOpen(false)}>Annuleren</button>
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────
export function TeamEditorModal({ state, onClose, notify }) {
  const teams = useTeams();

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">Teams beheren</div>
            <div className="bm-modal-sub">Klik op een team om te bewerken</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="bm-te-list">
          {teams.map(team => (
            <TeamRow
              key={team.id}
              team={team}
              state={state}
              onSaved={onClose}
              onDeleted={onClose}
              notify={notify}
            />
          ))}
        </div>

        <div style={{ padding: '8px 20px 20px' }}>
          <NewTeamForm onCreated={onClose} notify={notify} />
        </div>
      </div>
    </div>
  );
}
