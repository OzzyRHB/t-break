import { useEffect, useState, useCallback } from 'react';
import { formatDisplayName } from '../lib/formatName';
import { TYPES } from '../lib/constants';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';
import { exportUserLogs, exportUserLogsRange } from '../lib/export';
import { fmtMs } from '../lib/helpers';
import { adminApi } from '../lib/adminApi';
import { sb } from '../lib/supabase';

// SVG Crown — consistent with Header.jsx
const IconCrown = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20h20M4 20 2 8l5 4 5-8 5 8 5-4-2 12H4z"/>
  </svg>
);


const ONLINE_MS = 2 * 60 * 1000;

// ── Create user modal ────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, notify }) {
  const teams = useTeams();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [extension, setExtension] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [team, setTeam] = useState('');
  const [makeLeader, setMakeLeader] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    if (!email || !firstName || !lastName || !extension || !tempPassword) {
      notify('Vul alle velden in', 'warn'); return;
    }
    if (lastName.trim().length < 2) {
      notify('Achternaam moet minimaal 2 tekens zijn', 'warn'); return;
    }
    if (tempPassword.length < 8) {
      notify('Wachtwoord minimaal 8 tekens', 'warn'); return;
    }
    const name = formatDisplayName(firstName, lastName, extension);
    setBusy(true);
    try {
      await adminApi.createUser(email.trim(), name, tempPassword, team || null, makeLeader);
      notify(`✓ ${name} aangemaakt`, 'ok');
      onCreated();
      onClose();
    } catch (e) {
      notify('Fout: ' + e.message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">Nieuwe gebruiker aanmaken</div>
            <div className="bm-modal-sub">Account wordt direct goedgekeurd</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="bm-modal-section-label">Naam</div>
        <div className="bm-modal-row" style={{ gap: 8 }}>
          <input className="bm-input" style={{ flex: 1 }} placeholder="Voornaam"
            value={firstName} onChange={e => setFirstName(e.target.value)} />
          <input className="bm-input" style={{ flex: 1 }} placeholder="Achternaam"
            value={lastName} onChange={e => setLastName(e.target.value)} />
        </div>
        <div className="bm-modal-row">
          <input className="bm-input bm-modal-select" placeholder="Toestelnummer (bijv. 210)"
            value={extension} onChange={e => setExtension(e.target.value.replace(/\D/g, ''))} />
        </div>
        {firstName && lastName && lastName.length >= 2 && extension && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '0 0 8px 0', fontFamily: 'Geist Mono' }}>
            Wordt weergegeven als: <strong style={{ color: 'var(--ink)' }}>
              {formatDisplayName(firstName, lastName, extension)}
            </strong>
          </div>
        )}

        <div className="bm-modal-section-label">Email</div>
        <div className="bm-modal-row">
          <input className="bm-input bm-modal-select" placeholder="werk@bedrijf.nl"
            type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="bm-modal-section-label">Tijdelijk wachtwoord</div>
        <div className="bm-modal-row" style={{ gap: 6 }}>
          <input className="bm-input" style={{ flex: 1 }}
            placeholder="Min. 8 tekens"
            type={showPw ? 'text' : 'password'}
            value={tempPassword} onChange={e => setTempPassword(e.target.value)} />
          <button className="bm-btn bm-btn-ghost bm-btn-sm"
            onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
        </div>

        <div className="bm-modal-section-label">Team (optioneel)</div>
        <div className="bm-modal-row">
          <select className="bm-team-select bm-modal-select" value={team}
            onChange={e => setTeam(e.target.value)}>
            <option value="">Geen team</option>
            {getTeamIds(teams).map(t => <option key={t} value={t}>{getTeamLabel(teams, t)}</option>)}
          </select>
        </div>

        <div className="bm-modal-section-label">Rol</div>
        <div className="bm-modal-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={makeLeader} onChange={e => setMakeLeader(e.target.checked)} />
            Admin-rechten geven
          </label>
        </div>

        <div className="bm-modal-row" style={{ paddingTop: 4, paddingBottom: 20, gap: 8 }}>
          <button className="bm-btn bm-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Bezig…' : 'Aanmaken'}
          </button>
          <button className="bm-btn bm-btn-ghost" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}

// ── Set password modal ───────────────────────────────────────────
function SetPasswordModal({ userId, userName, onClose, notify }) {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { notify('Minimaal 8 tekens', 'warn'); return; }
    setBusy(true);
    try {
      await adminApi.setPassword(userId, pw);
      notify(`Wachtwoord van ${userName} gewijzigd`, 'ok');
      onClose();
    } catch (e) {
      notify('Fout: ' + e.message, 'warn');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">Wachtwoord instellen</div>
            <div className="bm-modal-sub">{userName}</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bm-modal-section-label">Nieuw wachtwoord</div>
        <div className="bm-modal-row" style={{ gap: 6 }}>
          <input className="bm-input" style={{ flex: 1 }}
            placeholder="Min. 8 tekens"
            type={showPw ? 'text' : 'password'}
            value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
          <button className="bm-btn bm-btn-ghost bm-btn-sm"
            onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
        </div>
        <div className="bm-modal-row" style={{ paddingTop: 4, paddingBottom: 20, gap: 8 }}>
          <button className="bm-btn bm-btn-primary" onClick={submit} disabled={busy || pw.length < 8}>
            {busy ? 'Opslaan…' : 'Opslaan'}
          </button>
          <button className="bm-btn bm-btn-ghost" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}

// ── Export modal ─────────────────────────────────────────────────
function ExportModal({ userId, userName, onClose, notify }) {
  const teams = useTeams();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    await exportUserLogsRange(userId, userName, from, to, teams, notify);
    setBusy(false);
    onClose();
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="bm-modal-header">
          <div><div className="bm-modal-title">Logs exporteren</div><div className="bm-modal-sub">{userName}</div></div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bm-modal-section-label">Periode</div>
        <div className="bm-modal-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Van <input type="date" className="bm-input" value={from} max={to} onChange={e => setFrom(e.target.value)} style={{ flex: 1 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Tot <input type="date" className="bm-input" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} style={{ flex: 1 }} />
          </label>
        </div>
        <div className="bm-modal-row" style={{ paddingTop: 8, paddingBottom: 20, gap: 8 }}>
          <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={doExport} disabled={busy}>
            {busy ? 'Bezig…' : '↓ Download .csv'}
          </button>
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}

// ── Main UserManagement view ─────────────────────────────────────
// ── Activity log — matches main log column structure ─────────────
// Cols: Team | Naam | Logtekst | Type | Eindstatus | Overtijd | Start | Einde | Pauze Tijd | Log Tijd
function ActivityLog({ logs }) {
  const [open, setOpen] = useState(false);
  const teams = useTeams();

  const fmtTime = (ts) => ts
    ? new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    : '–';
  const fmtOver = (ms) => {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `+${m}m${s > 0 ? `${s}s` : ''}` : `+${s}s`;
  };
  const endReasonText = { early: 'VROEG', timer: 'TIMER', forfeit: 'VERLOPEN', 'leader-ended': 'ADMIN' };

  const TeamPill = ({ teamId }) => {
    if (!teamId) return <span />;
    return (
      <span
        className="bm-user-team-pill"
        style={{
          background: getTeamColor(teams, teamId),
          color: getTeamTextColor(teams, teamId),
        }}
      >
        {getTeamLabel(teams, teamId) || teamId}
      </span>
    );
  };

  return (
    <div className="bm-um-log">
      <div className="bm-um-log-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Laatste 50 activiteiten</span>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={() => setOpen(v => !v)}>
          {open ? '▲ Verberg' : '▼ Toon'}
        </button>
      </div>
      {open && (
        logs.length === 0
          ? <div className="bm-empty">Nog geen activiteit.</div>
          : <ul className="bm-admin-list">
              {logs.map(e => {
                if (e.kind === 'admin') {
                  return (
                    <li key={e.id} className="bm-admin-row bm-admin-row-admin">
                      <TeamPill teamId={e.team || e.action_data?.team} />
                      <span className="bm-admin-name">{e.admin_name || e.user_name}</span>
                      <span className="bm-admin-time-action">{e.action}</span>
                      {/* type | eindstatus | overtime | start | einde | pauzetijd — empty */}
                      <span /><span /><span /><span /><span /><span />
                      <span className="bm-admin-tag bm-admin-tag-admin">
                        {fmtTime(e.started_at || e.created_at)}
                      </span>
                    </li>
                  );
                }
                const EXPECTED = { brb: 180000, short: 900000, lunch: 1800000 };
                const exp = EXPECTED[e.break_type] || 0;
                const startMs = e.started_at ? new Date(e.started_at).getTime() : 0;
                const endMs   = e.ended_at   ? new Date(e.ended_at).getTime()   : 0;
                const durMs   = (startMs && endMs) ? endMs - startMs : (e.duration_ms || 0);
                const overMs  = exp > 0 && durMs > exp ? durMs - exp : 0;
                const isLate  = overMs > 0;
                const endReason = e.end_reason || 'timer';
                const pauzeStr = durMs > 0
                  ? `${Math.floor(durMs/60000)}m${String(Math.floor((durMs%60000)/1000)).padStart(2,'0')}s`
                  : '–';
                const logText = {
                  brb:   'is even BRB gegaan...',
                  short: 'heeft korte pauze genomen',
                  lunch: 'heeft lunchpauze genomen',
                }[e.break_type] || '';
                return (
                  <li key={e.id} className="bm-admin-row">
                    <TeamPill teamId={e.team} />
                    <span className="bm-admin-name">{e.user_name}</span>
                    <span className="bm-admin-log-text">
                      {logText}
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--ink-3)', fontFamily: 'Geist Mono' }}>
                        {e.started_at ? new Date(e.started_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </span>
                    <span className={`bm-admin-type bm-admin-type-${e.break_type}`} data-label={TYPES[e.break_type]?.label || ''}>
                      {TYPES[e.break_type]?.label || '–'}
                    </span>
                    <span>
                      {isLate
                        ? <span className="bm-admin-late-pill">LAAT</span>
                        : <span className={`bm-admin-tag bm-admin-tag-${endReason}`}>
                            {endReasonText[endReason] || endReason.toUpperCase()}
                          </span>
                      }
                    </span>
                    <span className="bm-admin-overtime">{isLate ? fmtOver(overMs) : ''}</span>
                    <span className="bm-admin-time-cell">{fmtTime(e.started_at)}</span>
                    <span className="bm-admin-time-cell">{fmtTime(e.ended_at)}</span>
                    <span className="bm-admin-time-cell">{pauzeStr}</span>
                    <span className="bm-admin-tag bm-admin-tag-admin">
                      {fmtTime(e.ended_at || e.started_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
      )}
    </div>
  );
}

export function UserManagement({ state, me, onAssignLeader, onAssignTeam, onGrantExtraBreak, onRemoveExtraBreak, onBack, notify, useNamingConvention = true, onToggleNamingConvention }) {
  const teams = useTeams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userLogs, setUserLogs] = useState({});
  const [modal, setModal] = useState(null); // { type: 'create'|'set_password'|'export', userId?, userName? }

  const sessions = state.sessions || {};
  const now = Date.now();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { users: fetched } = await adminApi.listUsers();
      setUsers(fetched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loadUserLog = async (userId, userName) => {
    if (userLogs[userId]) return;
    let { data } = await sb.from('logs').select('*').eq('user_id', userId)
      .order('started_at', { ascending: false }).limit(50);
    if (!data?.length) {
      const byName = await sb.from('logs').select('*').eq('user_name', userName)
        .order('started_at', { ascending: false }).limit(50);
      data = byName.data;
    }
    setUserLogs(prev => ({ ...prev, [userId]: data || [] }));
  };

  const deleteUser = async (userId, userName) => {
    if (!confirm(`"${userName}" permanent verwijderen inclusief login-account? Dit kan niet ongedaan worden gemaakt.`)) return;
    try {
      await adminApi.deleteUser(userId);
      notify(`${userName} verwijderd`, 'ok');
      refresh();
    } catch (e) {
      notify('Fout: ' + e.message, 'warn');
    }
  };

  const sendReset = async (email, name) => {
    try {
      await adminApi.sendReset(email);
      notify(`Wachtwoord-reset gestuurd naar ${name}`, 'ok');
    } catch (e) {
      notify('Fout: ' + e.message, 'warn');
    }
  };

  const toggleApproved = async (userId, userName, currentlyApproved) => {
    try {
      await adminApi.updateProfile(userId, { approved: !currentlyApproved });
      notify(`${userName} ${currentlyApproved ? 'geblokkeerd' : 'goedgekeurd'}`, 'ok');
      refresh();
    } catch (e) {
      notify('Fout: ' + e.message, 'warn');
    }
  };

  // Enrich with live session data
  const enriched = users.map(u => {
    const s = sessions[u.id] || {};
    const lastSeen = s.lastSeen || 0;
    const isOnline = lastSeen > 0 && now - lastSeen < ONLINE_MS;
    const p = u.profile;
    const team = p?.team || s.team || null;
    const teamData = team ? state.teams[team] : null;
    const usage = teamData?.usage?.[u.id] || { short: 0, lunch: 0 };
    const extra = teamData?.extraBreaks?.[u.id] || 0;
    const isOnBreak = !!(teamData && teamData.activeBreaks.some(b => b.userId === u.id));
    const isInQueue = !!(teamData && Object.values(teamData.queues).some(q => q.some(e => e.userId === u.id)));
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      email_confirmed: !!u.email_confirmed_at,
      // profile fields
      name: p?.name || u.email?.split('@')[0] || u.id.slice(0, 8),
      approved: p?.approved || false,
      isLeader: p?.is_leader || false,
      team,
      hasProfile: !!p,
      // live state
      isOnline, lastSeen, isOnBreak, isInQueue,
      shortUsed: usage.short || 0, lunchUsed: usage.lunch || 0,
      extra,
      shortLimit: teamData?.config?.shortPerDay || 2,
      lunchLimit: teamData?.config?.lunchPerDay || 1,
    };
  });

  const q = search.trim().toLowerCase();
  const filtered = enriched.filter(u => {
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (filter === 'online')   return u.isOnline;
    if (filter === 'offline')  return !u.isOnline && u.approved;
    if (filter === 'pending')  return !u.approved;
    if (filter === 'no_team')  return u.approved && !u.team;
    return true;
  });

  const counts = {
    all:     enriched.length,
    online:  enriched.filter(u => u.isOnline).length,
    offline: enriched.filter(u => !u.isOnline && u.approved).length,
    pending: enriched.filter(u => !u.approved).length,
    no_team: enriched.filter(u => u.approved && !u.team).length,
  };

  return (
    <section className="bm-leader">
      <div className="bm-leader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="bm-back-btn" onClick={onBack}>← Terug</button>
          <span className="bm-leader-eyebrow" style={{ margin: 0 }}>Gebruikersbeheer</span>
          <span className="bm-leader-h3-count">{enriched.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="bm-btn bm-btn-primary bm-btn-sm"
            onClick={() => setModal({ type: 'create' })}>
            + Nieuwe gebruiker
          </button>
          <button className="bm-cal-btn" style={{ padding: '0 12px', minWidth: 38 }} onClick={refresh} title="Vernieuwen">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.8"/>
              <path d="M13.5 2.5v3h-3"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Naming convention toggle */}
      <div className="bm-um-convention-bar">
        <div className="bm-um-convention-info">
          <span className="bm-um-convention-label">Naamconventie</span>
          <span className="bm-um-convention-sub">
            {useNamingConvention
              ? 'Aan — registratie vraagt voornaam + achternaam + toestel (bijv. Jane (JSm) 210)'
              : 'Uit — registratie vraagt alleen een vrije naam'}
          </span>
        </div>
        <button
          className={`bm-um-convention-toggle ${useNamingConvention ? 'bm-um-convention-toggle-on' : ''}`}
          onClick={() => onToggleNamingConvention?.(!useNamingConvention)}
          title={useNamingConvention ? 'Zet naamconventie uit' : 'Zet naamconventie aan'}
        >
          <span className="bm-um-convention-knob" />
        </button>
      </div>

      <div className="bm-leader-body">
        {/* Toolbar */}
        <div className="bm-um-toolbar">
          <div className="bm-um-filters">
            {[
              { key: 'all',     label: 'Alle',          count: counts.all },
              { key: 'online',  label: 'Online',         count: counts.online },
              { key: 'offline', label: 'Offline',        count: counts.offline },
              { key: 'pending', label: 'In afwachting',  count: counts.pending },
              { key: 'no_team', label: 'Geen team',      count: counts.no_team },
            ].map(f => (
              <button key={f.key}
                className={`bm-um-filter ${filter === f.key ? 'bm-um-filter-active' : ''}`}
                onClick={() => setFilter(f.key)}>
                {f.label} <span className="bm-um-filter-count">{f.count}</span>
              </button>
            ))}
          </div>
          <input className="bm-input bm-um-search" placeholder="Zoek op naam of email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="bm-empty">Laden van Supabase Auth…</div>
        ) : error ? (
          <div className="bm-um-error">
            <div>⚠ Kon gebruikers niet laden</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>{error}</div>
            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>
              Controleer of de Edge Function is gedeployed en de SUPABASE_SERVICE_ROLE_KEY is ingesteld.
            </div>
            <button className="bm-btn bm-btn-ghost bm-btn-sm" style={{ marginTop: 10 }} onClick={refresh}>
              Opnieuw proberen
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bm-empty">Geen gebruikers gevonden.</div>
        ) : (
          <div className="bm-um-list">
            {filtered.map(u => (
              <div key={u.id} className={`bm-um-card ${!u.approved ? 'bm-um-card-pending' : ''}`}>
                {/* Card header */}
                <div className="bm-um-card-head"
                  onClick={() => {
                    setExpandedUser(expandedUser === u.id ? null : u.id);
                    if (expandedUser !== u.id) loadUserLog(u.id, u.name);
                  }}>
                  <div className="bm-um-card-left">
                    <span className={`bm-um-status-dot ${u.isOnline ? 'bm-um-status-online' : 'bm-um-status-offline'}`}
                      title={u.isOnline ? 'Online' : 'Offline'} />
                    {u.isLeader && <span className="bm-um-crown" title="Admin"><IconCrown /></span>}
                    <div>
                      <div className="bm-um-name">
                        {u.name}
                        {u.id === me.userId && <span className="bm-user-badge-you">jij</span>}
                        {!u.email_confirmed && <span className="bm-um-unconfirmed" title="Email niet bevestigd">✉?</span>}
                      </div>
                      <div className="bm-um-email">{u.email}</div>
                    </div>
                  </div>
                  <div className="bm-um-card-right">
                    {u.isOnBreak  && <span className="bm-um-state-chip bm-um-state-break">op pauze</span>}
                    {u.isInQueue  && <span className="bm-um-state-chip bm-um-state-queue">wachtrij</span>}
                    {!u.approved
                      ? <span className="bm-um-pending-badge">In afwachting</span>
                      : u.team
                      ? <span className="bm-user-team-pill"
                          style={{ background: getTeamColor(teams, u.team), color: getTeamTextColor(teams, u.team) }}>
                          {getTeamLabel(teams, u.team)}
                        </span>
                      : <span className="bm-um-no-team">Geen team</span>
                    }
                    <span className="bm-um-expand-arrow">{expandedUser === u.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded body */}
                {expandedUser === u.id && (
                  <div className="bm-um-card-body">

                    {/* Pending approval — full width banner */}
                    {!u.approved && (
                      <div className="bm-um-actions-row bm-um-approval-row">
                        <span className="bm-um-action-label">Goedkeuren:</span>
                        <button className="bm-btn bm-btn-primary bm-btn-sm"
                          onClick={async () => {
                            await adminApi.updateProfile(u.id, { approved: true });
                            notify(`${u.name} goedgekeurd`, 'ok'); refresh();
                          }}>Als medewerker</button>
                        <button className="bm-btn bm-btn-ghost bm-btn-sm"
                          onClick={async () => {
                            await adminApi.updateProfile(u.id, { approved: true, is_leader: true });
                            notify(`${u.name} goedgekeurd als admin`, 'ok'); refresh();
                          }}>Als admin</button>
                      </div>
                    )}

                    {/* Two-column grid */}
                    <div className="bm-um-body-grid">

                      {/* LEFT — identity & access */}
                      <div className="bm-um-body-col">
                        <NameEdit userId={u.id} currentName={u.name} onSaved={(n) => {
                          notify(`Naam gewijzigd naar ${n}`, 'ok'); refresh();
                        }} notify={notify} />

                        <CodeEdit userId={u.id} currentName={u.name} onSaved={(n) => {
                          notify(`Afkorting gewijzigd`, 'ok'); refresh();
                        }} notify={notify} />

                        <div className="bm-um-actions-row">
                          <span className="bm-um-action-label">Team:</span>
                          <select className="bm-team-select" value={u.team || ''}
                            onChange={async e => {
                              if (!e.target.value) return;
                              await onAssignTeam(u.id, u.name, e.target.value);
                              refresh();
                            }}>
                            <option value="">Kies team…</option>
                            {getTeamIds(teams).map(t => <option key={t} value={t}>{getTeamLabel(teams, t)}</option>)}
                          </select>
                        </div>

                        <div className="bm-um-actions-row">
                          <span className="bm-um-action-label">Rol:</span>
                          <button
                            className={`bm-btn bm-btn-sm ${u.isLeader ? 'bm-btn-primary' : 'bm-btn-ghost'}`}
                            disabled={u.id === me.userId}
                            title={u.id === me.userId ? 'Kan eigen rol niet wijzigen' : ''}
                            onClick={async () => {
                              await onAssignLeader(u.id, u.name, !u.isLeader);
                              await adminApi.updateProfile(u.id, { is_leader: !u.isLeader });
                              refresh();
                            }}>
                            {u.isLeader ? 'Admin — klik om te verwijderen' : 'Maak admin'}
                          </button>
                        </div>

                        {u.id !== me.userId && (
                          <div className="bm-um-actions-row">
                            <span className="bm-um-action-label">Toegang:</span>
                            <button
                              className="bm-btn bm-btn-ghost bm-btn-sm"
                              style={{ color: u.approved ? 'var(--amber)' : 'var(--sage)' }}
                              onClick={() => toggleApproved(u.id, u.name, u.approved)}>
                              {u.approved ? '⊘ Blokkeer gebruiker' : '✓ Herstel toegang'}
                            </button>
                          </div>
                        )}

                        {u.team && (
                          <div className="bm-um-actions-row">
                            <span className="bm-um-action-label">Pauzes:</span>
                            <span className="bm-um-usage">
                              {u.shortUsed}/{u.shortLimit + u.extra} kort · {u.lunchUsed}/{u.lunchLimit} lunch
                            </span>
                            <button className="bm-cal-btn"
                              onClick={() => onGrantExtraBreak(u.team, u.id, u.name)}>
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M12 9h1a2 2 0 0 0 0-4h-1"/></svg>
                              Extra korte pauze
                            </button>
                            {u.extra > 0 && <>
                              <span className="bm-extra-badge">+{u.extra}</span>
                              <button className="bm-btn bm-btn-ghost bm-btn-sm"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => onRemoveExtraBreak(u.team, u.id, u.name)}>
                                − verwijder extra
                              </button>
                            </>}
                          </div>
                        )}
                      </div>

                      {/* RIGHT — account management */}
                      <div className="bm-um-body-col">
                        <div className="bm-um-actions-row">
                          <span className="bm-um-action-label">Wachtwoord:</span>
                          <button className="bm-cal-btn"
                            onClick={() => setModal({ type: 'set_password', userId: u.id, userName: u.name })}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2m0 10v2M1 8h2m10 0h2m-3.2-4.8-1.4 1.4M4.6 11.4 3.2 12.8m0-9.6 1.4 1.4m6.8 6.8 1.4 1.4"/></svg>
                            Nieuw wachtwoord
                          </button>
                          <button className="bm-cal-btn"
                            onClick={() => sendReset(u.email, u.name)}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="9" rx="1"/><path d="M2 5l6 5 6-5"/></svg>
                            Stuur reset-link
                          </button>
                        </div>

                        <div className="bm-um-actions-row">
                          <span className="bm-um-action-label">Export:</span>
                          <button className="bm-cal-btn"
                            onClick={() => setModal({ type: 'export', userId: u.id, userName: u.name })}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v8m-4-3 4 4 4-4"/><path d="M3 14h10"/></svg>
                            Exporteer logs (.csv)
                          </button>
                        </div>

                        <div className="bm-um-meta-row">
                          Aangemaakt: {u.created_at ? new Date(u.created_at).toLocaleDateString('nl-NL') : '—'}<br/>
                          Laatste login: {u.last_sign_in ? new Date(u.last_sign_in).toLocaleString('nl-NL') : 'Nooit'}<br/>
                          Laatste online: {u.lastSeen > 0 ? new Date(u.lastSeen).toLocaleString('nl-NL') : 'Nooit'}
                        </div>

                        {u.id !== me.userId && (
                          <div className="bm-um-actions-row" style={{ marginTop: 'auto', paddingTop: 8 }}>
                            <span className="bm-um-action-label">Gevaarlijk:</span>
                            <button className="bm-btn bm-btn-ghost bm-btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                              onClick={() => deleteUser(u.id, u.name)}>
                              🗑 Verwijder account permanent
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activity log — full width below both columns */}
                    {userLogs[u.id] !== undefined && (
                      <ActivityLog logs={userLogs[u.id]} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateUserModal onClose={() => setModal(null)} onCreated={refresh} notify={notify} />
      )}
      {modal?.type === 'set_password' && (
        <SetPasswordModal userId={modal.userId} userName={modal.userName}
          onClose={() => setModal(null)} notify={notify} />
      )}
      {modal?.type === 'export' && (
        <ExportModal userId={modal.userId} userName={modal.userName}
          onClose={() => setModal(null)} notify={notify} />
      )}
    </section>
  );
}

// Swap just the (XXX) code in a stored display name, keeping the rest intact.
// "Jane (JSm) 210"  +  "JDo"  →  "Jane (JDo) 210"
function swapCode(displayName, newCode) {
  return displayName.replace(/\([A-Za-z]{2,4}\)/, `(${newCode})`);
}

// Inline code edit — lets admin fix the 3-letter identifier only
function CodeEdit({ userId, currentName, onSaved, notify }) {
  const [editing, setEditing] = useState(false);
  const codeMatch = currentName.match(/\(([A-Za-z]{2,4})\)/);
  const currentCode = codeMatch ? codeMatch[1] : '';
  const [code, setCode] = useState(currentCode);

  const open = () => { setCode(currentCode); setEditing(true); };

  const save = async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed === currentCode) { setEditing(false); return; }
    if (trimmed.length < 2 || trimmed.length > 4) {
      notify('Code moet 2–4 letters zijn', 'warn'); return;
    }
    const newName = swapCode(currentName, trimmed);
    try {
      await adminApi.updateProfile(userId, { name: newName });
      onSaved(newName);
      setEditing(false);
    } catch (e) { notify('Fout: ' + e.message, 'warn'); }
  };

  if (!codeMatch) return null; // name not in convention format, skip

  return (
    <div className="bm-um-actions-row">
      <span className="bm-um-action-label">Afkorting:</span>
      {editing ? <>
        <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'Geist Mono' }}>(</span>
        <input
          className="bm-input"
          style={{ width: 64, fontFamily: 'Geist Mono', textAlign: 'center', padding: '4px 6px' }}
          value={code}
          maxLength={4}
          autoFocus
          onChange={e => setCode(e.target.value.replace(/[^A-Za-z]/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'Geist Mono' }}>)</span>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={save}>Opslaan</button>
        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setEditing(false)}>Annuleren</button>
      </> : <>
        <span style={{ fontSize: 13, fontFamily: 'Geist Mono', color: 'var(--ink-2)' }}>({currentCode})</span>
        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={open}>✏ Wijzig afkorting</button>
      </>}
    </div>
  );
}

// Inline name edit — uses three fields to enforce naming convention
function NameEdit({ userId, currentName, onSaved, notify }) {
  const isConvention = /^\S+\s+\([A-Za-z]{2,4}\)\s+\d+$/.test(currentName);

  const [editing, setEditing]     = useState(false);
  const [freeMode, setFreeMode]   = useState(!isConvention);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [extension, setExtension] = useState('');
  const [freeName, setFreeName]   = useState('');

  const startEdit = () => {
    if (isConvention) {
      // Pre-fill first name + extension; last name can't be recovered from code
      const m = currentName.match(/^(\S+)\s+\([A-Za-z]{2,4}\)\s+(\d+)$/);
      setFirstName(m ? m[1] : '');
      setExtension(m ? m[2] : '');
      setLastName('');
      setFreeMode(false);
    } else {
      setFreeName(currentName);
      setFreeMode(true);
    }
    setEditing(true);
  };

  const save = async () => {
    let name;
    if (freeMode) {
      name = freeName.trim();
      if (!name) { notify('Voer een naam in', 'warn'); return; }
    } else {
      if (!firstName.trim() || !lastName.trim() || !extension.trim()) {
        notify('Vul alle drie de velden in', 'warn'); return;
      }
      if (lastName.trim().length < 2) {
        notify('Achternaam moet minimaal 2 tekens zijn', 'warn'); return;
      }
      name = formatDisplayName(firstName, lastName, extension);
    }
    if (name === currentName) { setEditing(false); return; }
    try {
      await adminApi.updateProfile(userId, { name });
      onSaved(name);
      setEditing(false);
    } catch (e) { notify('Fout: ' + e.message, 'warn'); }
  };

  const preview = !freeMode && firstName && lastName && lastName.length >= 2 && extension
    ? formatDisplayName(firstName, lastName, extension) : null;

  if (!editing) return (
    <div className="bm-um-actions-row">
      <span className="bm-um-action-label">Naam:</span>
      <span style={{ fontSize: 13, fontFamily: 'Geist Mono' }}>{currentName}</span>
      <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={startEdit}>✏ Wijzig naam</button>
    </div>
  );

  return (
    <div className="bm-um-actions-row" style={{ flexWrap: 'wrap', gap: 6 }}>
      <span className="bm-um-action-label">Naam:</span>
      {/* Mode toggle */}
      <button
        className={`bm-um-log-toggle ${!freeMode ? 'bm-um-log-toggle-active' : ''}`}
        onClick={() => setFreeMode(false)} title="Gebruik naamconventie">
        Conventie
      </button>
      <button
        className={`bm-um-log-toggle ${freeMode ? 'bm-um-log-toggle-active' : ''}`}
        onClick={() => setFreeMode(true)} title="Vrije naam (bijv. Admin)">
        Vrij
      </button>
      <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {freeMode ? (
          <input className="bm-input" style={{ width: 200 }} placeholder="Bijv. Admin"
            value={freeName} onChange={e => setFreeName(e.target.value)}
            autoFocus onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
        ) : <>
          <input className="bm-input" style={{ width: 100 }} placeholder="Voornaam"
            value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
          <input className="bm-input" style={{ width: 110 }} placeholder="Achternaam"
            value={lastName} onChange={e => setLastName(e.target.value)} />
          <input className="bm-input" style={{ width: 70 }} placeholder="Toestel"
            value={extension} onChange={e => setExtension(e.target.value.replace(/\D/g, ''))} />
          {preview && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'Geist Mono', alignSelf: 'center' }}>
              → <strong style={{ color: 'var(--ink)' }}>{preview}</strong>
            </span>
          )}
        </>}
      </div>
      <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={save}>Opslaan</button>
      <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setEditing(false)}>Annuleren</button>
    </div>
  );
}
