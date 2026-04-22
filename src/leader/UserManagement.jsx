import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase';
import { TEAMS, TEAM_LABELS, TEAM_COLORS, TYPES, teamTextColor } from '../lib/constants';
import { fmtMs } from '../lib/helpers';

const ONLINE_MS = 2 * 60 * 1000;

export function UserManagement({ state, me, pendingUsers, onApprove, onAssignLeader, onAssignTeam, onGrantExtraBreak, onRemoveExtraBreak, onBack, notify }) {
  const [allProfiles, setAllProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userLogs, setUserLogs] = useState({});
  const [search, setSearch] = useState('');
  const [exportModal, setExportModal] = useState(null); // userId

  const refresh = async () => {
    setLoading(true);
    const { data } = await sb.from('profiles').select('*').order('name');
    setAllProfiles(data || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const ch = sb.channel('um_ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh)
      .subscribe();
    return () => ch.unsubscribe();
  }, []);

  const loadUserLog = async (userId) => {
    if (userLogs[userId]) return;
    const { data } = await sb.from('logs').select('*').eq('user_id', userId)
      .order('started_at', { ascending: false }).limit(50);
    setUserLogs(prev => ({ ...prev, [userId]: data || [] }));
  };

  const toggleExpand = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    await loadUserLog(userId);
  };

  const deleteUser = async (profileId, userName) => {
    if (!confirm(`Gebruiker "${userName}" permanent verwijderen?`)) return;
    const { error } = await sb.from('profiles').delete().eq('id', profileId);
    if (error) { notify?.('Fout: ' + error.message, 'warn'); return; }
    notify?.(`${userName} verwijderd`, 'ok');
    refresh();
  };

  const sendReset = async (email, name) => {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) { notify?.('Fout: ' + error.message, 'warn'); }
    else { notify?.(`Wachtwoord-reset gestuurd naar ${name}`, 'ok'); }
  };

  const now = Date.now();
  const sessions = state.sessions || {};

  // Merge Supabase profiles (source of truth for all accounts) with live session state
  const enriched = allProfiles.map(p => {
    const s = sessions[p.id] || {};
    const lastSeen = s.lastSeen || 0;
    const isOnline = lastSeen > 0 && now - lastSeen < ONLINE_MS;
    const team = p.team || s.team || null;
    const teamData = team ? state.teams[team] : null;
    const usage = teamData?.usage?.[p.id] || { short: 0, lunch: 0 };
    const extra = teamData?.extraBreaks?.[p.id] || 0;
    const isOnBreak = !!(teamData && teamData.activeBreaks.some(b => b.userId === p.id));
    const isInQueue = !!(teamData && Object.values(teamData.queues).some(q => q.some(e => e.userId === p.id)));
    return {
      id: p.id, name: p.name, email: p.email,
      approved: p.approved, isLeader: p.is_leader,
      team, isOnline, lastSeen, isOnBreak, isInQueue,
      shortUsed: usage.short || 0, lunchUsed: usage.lunch || 0,
      extra,
      shortLimit: teamData?.config?.shortPerDay || 2,
      lunchLimit: teamData?.config?.lunchPerDay || 1,
    };
  });

  // Robust search: trim, lowercase, match any part of name or email
  const q = search.trim().toLowerCase();
  const searched = enriched.filter(u => {
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (filter === 'online')  return u.isOnline;
    if (filter === 'offline') return !u.isOnline && u.approved;
    if (filter === 'pending') return !u.approved;
    return true;
  });

  const counts = {
    all: enriched.length,
    online: enriched.filter(u => u.isOnline).length,
    offline: enriched.filter(u => !u.isOnline && u.approved).length,
    pending: enriched.filter(u => !u.approved).length,
  };

  return (
    <section className="bm-leader">
      <div className="bm-leader-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="bm-back-btn" onClick={onBack}>← Terug</button>
          <span className="bm-leader-eyebrow" style={{ margin: 0 }}>Gebruikersbeheer</span>
        </div>
        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={refresh}>↻ Vernieuwen</button>
      </div>

      <div className="bm-leader-body">
        <div className="bm-um-toolbar">
          <div className="bm-um-filters">
            {[
              { key: 'all', label: 'Alle', count: counts.all },
              { key: 'online', label: 'Online', count: counts.online },
              { key: 'offline', label: 'Offline', count: counts.offline },
              { key: 'pending', label: 'In afwachting', count: counts.pending },
            ].map(f => (
              <button key={f.key} className={`bm-um-filter ${filter === f.key ? 'bm-um-filter-active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label} <span className="bm-um-filter-count">{f.count}</span>
              </button>
            ))}
          </div>
          <input className="bm-input bm-um-search" placeholder="Zoek op naam of email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? <div className="bm-empty">Laden…</div>
        : searched.length === 0 ? <div className="bm-empty">Geen gebruikers gevonden.</div>
        : (
          <div className="bm-um-list">
            {searched.map(u => (
              <div key={u.id} className="bm-um-card">
                <div className="bm-um-card-head" onClick={() => toggleExpand(u.id)}>
                  <div className="bm-um-card-left">
                    <span className={`bm-um-status-dot ${u.isOnline ? 'bm-um-status-online' : 'bm-um-status-offline'}`} />
                    {u.isLeader && <span className="bm-um-crown">♛</span>}
                    <div>
                      <div className="bm-um-name">
                        {u.name}
                        {u.id === me.userId && <span className="bm-user-badge-you">jij</span>}
                      </div>
                      <div className="bm-um-email">{u.email}</div>
                    </div>
                  </div>
                  <div className="bm-um-card-right">
                    {!u.approved
                      ? <span className="bm-um-pending-badge">In afwachting</span>
                      : u.team
                      ? <span className="bm-user-team-pill" style={{ background: TEAM_COLORS[u.team], color: teamTextColor(u.team) }}>{TEAM_LABELS[u.team]}</span>
                      : <span className="bm-um-no-team">Geen team</span>
                    }
                    {u.isOnBreak  && <span className="bm-um-state-chip bm-um-state-break">op pauze</span>}
                    {u.isInQueue  && <span className="bm-um-state-chip bm-um-state-queue">wachtrij</span>}
                    <span className="bm-um-expand-arrow">{expandedUser === u.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expandedUser === u.id && (
                  <div className="bm-um-card-body">
                    {!u.approved ? (
                      <div className="bm-um-actions-row">
                        <span className="bm-um-action-label">Goedkeuren:</span>
                        <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={() => onApprove(u.id, false)}>Als medewerker</button>
                        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => onApprove(u.id, true)}>Als admin</button>
                      </div>
                    ) : (<>
                      <div className="bm-um-actions-row">
                        <span className="bm-um-action-label">Team:</span>
                        <select className="bm-team-select" value={u.team || ''}
                          onChange={e => e.target.value && onAssignTeam(u.id, u.name, e.target.value)}>
                          <option value="">Kies team…</option>
                          {TEAMS.map(t => <option key={t} value={t}>{TEAM_LABELS[t]}</option>)}
                        </select>
                      </div>
                      <div className="bm-um-actions-row">
                        <span className="bm-um-action-label">Rol:</span>
                        <button className={`bm-btn bm-btn-sm ${u.isLeader ? 'bm-btn-primary' : 'bm-btn-ghost'}`}
                          disabled={u.id === me.userId}
                          onClick={() => onAssignLeader(u.id, u.name, !u.isLeader)}>
                          {u.isLeader ? '♛ Admin (klik om te verwijderen)' : 'Maak admin'}
                        </button>
                      </div>
                      {u.team && (
                        <div className="bm-um-actions-row">
                          <span className="bm-um-action-label">Vandaag:</span>
                          <span className="bm-um-usage">{u.shortUsed}/{u.shortLimit + u.extra} korte · {u.lunchUsed}/{u.lunchLimit} lunch</span>
                          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => onGrantExtraBreak(u.team, u.id, u.name)}>+ extra korte pauze</button>
                          {u.extra > 0 && <>
                            <span className="bm-extra-badge">+{u.extra}</span>
                            <button className="bm-btn bm-btn-ghost bm-btn-sm" style={{ color: 'var(--danger)' }}
                              onClick={() => onRemoveExtraBreak(u.team, u.id, u.name)}>− verwijder extra</button>
                          </>}
                        </div>
                      )}
                      <div className="bm-um-actions-row">
                        <span className="bm-um-action-label">Account:</span>
                        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => sendReset(u.email, u.name)}>✉ Wachtwoord-reset</button>
                        <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => setExportModal(u.id)}>↓ Exporteer logs</button>
                        {u.id !== me.userId && (
                          <button className="bm-btn bm-btn-ghost bm-btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => deleteUser(u.id, u.name)}>🗑 Verwijder</button>
                        )}
                      </div>
                      <div className="bm-um-meta-row">
                        Laatst online: {u.lastSeen > 0 ? new Date(u.lastSeen).toLocaleString('nl-NL') : 'Nooit'}
                      </div>
                      {userLogs[u.id] && (
                        <div className="bm-um-log">
                          <div className="bm-um-log-title">Laatste 50 activiteiten</div>
                          {userLogs[u.id].length === 0 ? <div className="bm-empty">Nog geen activiteit.</div> : (
                            <ul className="bm-admin-list">
                              {userLogs[u.id].slice(0, 50).map(e => {
                                if (e.kind === 'admin') return (
                                  <li key={e.id} className="bm-admin-row bm-admin-row-admin">
                                    <span className="bm-admin-name">{e.admin_name}</span>
                                    <span className="bm-admin-time bm-admin-time-action">{e.action}</span>
                                    <span className="bm-admin-tag bm-admin-tag-admin">
                                      {new Date(e.started_at || e.created_at).toLocaleString('nl-NL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </li>
                                );
                                const started = new Date(e.started_at);
                                const ended = e.ended_at ? new Date(e.ended_at) : null;
                                return (
                                  <li key={e.id} className="bm-admin-row">
                                    <span className={`bm-admin-type bm-admin-type-${e.break_type}`}>{TYPES[e.break_type]?.label}</span>
                                    <span className="bm-admin-time">
                                      {started.toLocaleString('nl-NL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      {' → '}{ended ? ended.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '–'}
                                      {e.duration_ms ? ` (${fmtMs(e.duration_ms)})` : ''}
                                    </span>
                                    <span className={`bm-admin-tag bm-admin-tag-${e.end_reason}`}>{e.end_reason}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export date range modal */}
      {exportModal && (
        <ExportModal
          userId={exportModal}
          userName={enriched.find(u => u.id === exportModal)?.name || ''}
          onClose={() => setExportModal(null)}
          notify={notify}
        />
      )}
    </section>
  );
}

// ── Export modal with date range picker ─────────────────────────
function ExportModal({ userId, userName, onClose, notify }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const doExport = async (fmt) => {
    setBusy(true);
    const { data, error } = await sb.from('logs').select('*')
      .eq('user_id', userId)
      .gte('log_date', from).lte('log_date', to)
      .order('started_at', { ascending: true });
    setBusy(false);
    if (error || !data?.length) {
      notify?.('Geen logs gevonden voor deze periode', 'warn');
      return;
    }
    const rows = [
      ['Datum', 'Type', 'Start', 'Einde', 'Duur (min)', 'Reden'],
      ...data.map(r => [
        r.log_date,
        r.break_type || r.action || '',
        r.started_at ? new Date(r.started_at).toLocaleString('nl-NL') : '',
        r.ended_at   ? new Date(r.ended_at).toLocaleString('nl-NL')   : '',
        r.duration_ms ? (r.duration_ms / 60000).toFixed(1) : '',
        r.end_reason || r.action || '',
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tbreak-${userName.replace(/\s+/g,'-')}-${from}--${to}.csv`;
    a.click();
    onClose();
  };

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">Logs exporteren</div>
            <div className="bm-modal-sub">{userName}</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bm-modal-section-label">Periode</div>
        <div className="bm-modal-row" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
          <label className="bm-um-action-label" style={{ width: 'auto' }}>
            Van
            <input type="date" className="bm-input" value={from} max={to}
              onChange={e => setFrom(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
          <label className="bm-um-action-label" style={{ width: 'auto' }}>
            Tot
            <input type="date" className="bm-input" value={to} min={from} max={today}
              onChange={e => setTo(e.target.value)} style={{ marginLeft: 8 }} />
          </label>
        </div>
        <div className="bm-modal-row" style={{ paddingTop: 4, paddingBottom: 20 }}>
          <button className="bm-btn bm-btn-primary bm-btn-sm" onClick={() => doExport('csv')} disabled={busy}>
            {busy ? 'Bezig…' : '↓ Download .csv'}
          </button>
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  );
}
