import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('bm:dark') === '1'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('bm-dark', dark);
    try { localStorage.setItem('bm:dark', dark ? '1' : '0'); } catch {}
  }, [dark]);
  return [dark, setDark];
}

// ── SVG icons in brand red ──────────────────────────────────────
const IconCrown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h20M4 20 2 8l5 4 5-8 5 8 5-4-2 12H4z"/>
  </svg>
);

const IconEmployee = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

const IconAdmin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconKey = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5"/>
    <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>
  </svg>
);

// ── Change password modal ───────────────────────────────────────
function ChangePasswordModal({ onClose, notify }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { notify('Minimaal 8 tekens', 'warn'); return; }
    if (pw !== pw2) { notify('Wachtwoorden komen niet overeen', 'warn'); return; }
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { notify('Fout: ' + error.message, 'warn'); return; }
    notify('Wachtwoord gewijzigd', 'ok');
    onClose();
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="bm-modal-header">
          <div className="bm-modal-title">Wachtwoord wijzigen</div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="bm-input" type="password" placeholder="Nieuw wachtwoord"
            value={pw} onChange={e => setPw(e.target.value)} autoFocus />
          <input className="bm-input" type="password" placeholder="Bevestig wachtwoord"
            value={pw2} onChange={e => setPw2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} />
          <button className="bm-btn bm-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────
export function Header({ me, onSignOut, onToggleLeader, isEmployeeView, notify, myTeam, onRequestTeamSwitch }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const [dark, setDark] = useDarkMode();
  const [showChangePw, setShowChangePw] = useState(false);
  const teams = useTeams();
  const teamIds = getTeamIds(teams);

  return (
    <header className="bm-header">
      {/* Brand */}
      <div className="bm-brand">
        <span className="bm-brand-mark">▣</span>
        <span className="bm-brand-name">T-BREAK</span>
      </div>

      {/* Team pills — center */}
      {teamIds.length > 0 && (
        <div className="bm-header-teams">
          {teamIds.map((t) => (
            <button
              key={t}
              className={`bm-header-team-pill ${myTeam === t ? 'bm-header-team-pill-active' : ''}`}

              onClick={() => myTeam !== t && onRequestTeamSwitch?.(t)}
            >
              {getTeamLabel(teams, t)}
            </button>
          ))}
        </div>
      )}

      {/* Right side */}
      <div className="bm-header-right">
        <button className="bm-dark-toggle" onClick={() => setDark(d => !d)}
          title={dark ? 'Lichte modus' : 'Donkere modus'} aria-label="Donkere modus">
          {dark ? '☀' : '☾'}
        </button>

        {/* Chip — crown ALWAYS visible for admins, even in employee view */}
        <button className="bm-chip" onClick={() => setOpen(v => !v)}>
          {me.isLeader && (
            <span className="bm-chip-crown">
              <IconCrown />
            </span>
          )}
          <span>{me.name}</span>
        </button>

        {open && (
          <div className="bm-menu">
            {me.isLeader && !isEmployeeView && (
              <button className="bm-menu-item" onClick={() => { onToggleLeader(); setOpen(false); }}>
                <span className="bm-menu-icon"><IconEmployee /></span>
                Medewerkerweergave
              </button>
            )}
            {me.isLeader && isEmployeeView && (
              <button className="bm-menu-item" onClick={() => { onToggleLeader(); setOpen(false); }}>
                <span className="bm-menu-icon"><IconCrown /></span>
                Admin weergave
              </button>
            )}
            <button className="bm-menu-item" onClick={() => { setShowChangePw(true); setOpen(false); }}>
              <span className="bm-menu-icon"><IconKey /></span>
              Wachtwoord wijzigen
            </button>
            <div className="bm-menu-divider" />
            <button className="bm-menu-item" onClick={() => { onSignOut(); setOpen(false); }}>
              Uitloggen
            </button>
          </div>
        )}
      </div>

      {showChangePw && (
        <ChangePasswordModal onClose={() => setShowChangePw(false)} notify={notify} />
      )}
    </header>
  );
}
