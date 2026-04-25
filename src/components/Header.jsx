import { useState } from 'react';
import { sb } from '../lib/supabase';
import { getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';
import { useDarkMode } from '../hooks/useDarkMode';

function ChangePasswordModal({ onClose, notify }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 8) { notify?.('Minimaal 8 tekens', 'warn'); return; }
    if (pw !== pw2) { notify?.('Wachtwoorden komen niet overeen', 'warn'); return; }
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { notify?.('Fout: ' + error.message, 'warn'); }
    else { notify?.('Wachtwoord gewijzigd', 'ok'); onClose(); }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="bm-modal-header">
          <div><div className="bm-modal-title">Wachtwoord wijzigen</div></div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bm-modal-section-label">Nieuw wachtwoord</div>
        <div className="bm-modal-row" style={{ gap: 6 }}>
          <input className="bm-input" style={{ flex: 1 }} placeholder="Min. 8 tekens"
            type={showPw ? 'text' : 'password'} value={pw}
            onChange={e => setPw(e.target.value)} autoFocus />
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setShowPw(v => !v)}>
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
        <div className="bm-modal-section-label">Bevestig wachtwoord</div>
        <div className="bm-modal-row">
          <input className="bm-input bm-modal-select" placeholder="Herhaal wachtwoord"
            type={showPw ? 'text' : 'password'} value={pw2}
            onChange={e => setPw2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()} />
        </div>
        <div className="bm-modal-row" style={{ paddingTop: 4, paddingBottom: 20, gap: 8 }}>
          <button className="bm-btn bm-btn-primary" onClick={save} disabled={busy || pw.length < 8}>
            {busy ? 'Opslaan…' : 'Opslaan'}
          </button>
          <button className="bm-btn bm-btn-ghost" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}

export function Header({ me, onSignOut, onToggleLeader, myTeam, onRequestTeamSwitch, isEmployeeView, notify, teams = [] }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [showChangePw, setShowChangePw] = useState(false);

  return (
    <header className="bm-header">
      <div className="bm-brand">
        <span className="bm-brand-mark">▣</span>
        <span className="bm-brand-name">T-BREAK</span>
      </div>

      {/* Employee team switcher */}
      {(!me.isLeader || isEmployeeView) && (
        <div className="bm-header-team-switcher">
          {getTeamIds(teams).map(team => {
            const isCurrent = myTeam === team;
            const color = getTeamColor(teams, team);
            return (
              <button key={team}
                className={`bm-header-team-pill ${isCurrent ? 'bm-header-team-pill-active' : ''}`}
                style={isCurrent
                  ? { background: color, borderColor: color, color: getTeamTextColor(teams, team) }
                  : { borderColor: color + '66', color: color }
                }
                onClick={() => !isCurrent && onRequestTeamSwitch(team)}
                disabled={isCurrent}
                title={isCurrent ? `Huidig team: ${getTeamLabel(teams, team)}` : `Wissel naar ${getTeamLabel(teams, team)}`}
              >
                {getTeamLabel(teams, team)}
              </button>
            );
          })}
        </div>
      )}

      <div className="bm-header-right bm-header-actions">
        <button className="bm-dark-toggle" onClick={() => setDark(d => !d)}
          title={dark ? 'Lichte modus' : 'Donkere modus'} aria-label="Schakel donkere modus">
          {dark ? '☀' : '☾'}
        </button>
        <button className="bm-chip" onClick={() => setOpen(v => !v)}>
          {me.isLeader && !isEmployeeView && <span className="bm-chip-crown">♛</span>}
          <span>{me.name}</span>
        </button>
        {open && (
          <div className="bm-menu" onMouseLeave={() => setOpen(false)}>
            {me.isLeader && !isEmployeeView && (
              <button className="bm-menu-item" onClick={() => { onToggleLeader(); setOpen(false); }}>
                👤 Medewerkerweergave
              </button>
            )}
            {me.isLeader && isEmployeeView && (
              <button className="bm-menu-item" onClick={() => { onToggleLeader(); setOpen(false); }}>
                ♛ Admin weergave
              </button>
            )}
            <button className="bm-menu-item" onClick={() => { setShowChangePw(true); setOpen(false); }}>
              🔑 Wachtwoord wijzigen
            </button>
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
