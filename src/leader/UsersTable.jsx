import { useState, useRef, useEffect } from 'react';
import { sb } from '../lib/supabase';
import { TYPES } from '../lib/constants';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from '../lib/TeamsContext';
import { fmtMs } from '../lib/helpers';

// Is this user currently overrun, or did they have an overrun break today?
function getUserOvertimeTeam(state, uid) {
  // Check historical overrun flag (set when a user ends a break late)
  if (state.overrunToday?.[uid]) return 'historical';
  // Check live overrun (currently on break past their timer)
  const now = Date.now();
  for (const team of Object.keys(state.teams)) {
    const t = state.teams[team];
    for (const b of t.activeBreaks || []) {
      if (b.userId !== uid) continue;
      const dur = t.config[TYPES[b.type]?.durKey];
      if (dur && now > b.startedAt + dur * 1000) return team;
    }
  }
  return null;
}

// ── Popup action modal ───────────────────────────────────────────
function UserActionsModal({ u, state, me, onClose, onAssignTeam, onAssignLeader, onGrantExtraBreak, onRemoveExtraBreak, notify }) {
  const teams = useTeams();
  const [teamVal, setTeamVal] = useState(u.team || '');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const sendPasswordReset = async () => {
    setBusy(true);
    const redirectTo = `${window.location.origin}/`;
    const { error } = await sb.auth.resetPasswordForEmail(u.email, { redirectTo });
    setBusy(false);
    if (error) { notify?.('Fout: ' + error.message, 'warn'); }
    else { notify?.(`Wachtwoord-reset gestuurd naar ${u.email}`, 'ok'); onClose(); }
  };

  const exportLogs = async () => {
    setBusy(true);
    const { data } = await sb.from('logs').select('*').eq('user_id', u.uid).order('started_at', { ascending: false });
    setBusy(false);
    if (!data?.length) { notify?.('Geen logs gevonden', 'warn'); return; }
    const rows = [
      ['Datum', 'Type', 'Start', 'Einde', 'Duur (min)', 'Reden'],
      ...data.map(r => [
        r.log_date,
        r.break_type || r.action || '',
        r.started_at ? new Date(r.started_at).toLocaleString('nl-NL') : '',
        r.ended_at   ? new Date(r.ended_at).toLocaleString('nl-NL')   : '',
        r.duration_ms ? Math.round(r.duration_ms / 60000) : '',
        r.end_reason || r.action || '',
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tbreak-logs-${u.name.replace(/\s+/g,'-')}.csv`;
    a.click();
    onClose();
  };

  const deleteUser = async () => {
    if (!confirm(`"${u.name}" permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    const { error } = await sb.from('profiles').delete().eq('id', u.uid);
    if (error) { notify?.('Fout bij verwijderen: ' + error.message, 'warn'); }
    else { notify?.(`${u.name} verwijderd`, 'ok'); onClose(); }
  };

  const teamData = u.team ? state.teams[u.team] : null;
  const extra = teamData?.extraBreaks?.[u.uid] || 0;

  return (
    <div className="bm-modal-backdrop" onClick={onClose}>
      <div className="bm-modal-popup" ref={ref} onClick={e => e.stopPropagation()}>
        <div className="bm-modal-header">
          <div>
            <div className="bm-modal-title">{u.name}</div>
            <div className="bm-modal-sub">{u.email}</div>
          </div>
          <button className="bm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="bm-modal-section-label">Team</div>
        <div className="bm-modal-row">
          <select className="bm-team-select bm-modal-select" value={teamVal}
            onChange={e => { setTeamVal(e.target.value); if (e.target.value) { onAssignTeam(u.uid, u.name, e.target.value); onClose(); } }}>
            <option value="">Kies team…</option>
            {getTeamIds(teams).map(t => <option key={t} value={t}>{getTeamLabel(teams, t)}</option>)}
          </select>
        </div>

        <div className="bm-modal-section-label">Korte pauzes</div>
        <div className="bm-modal-row">
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={() => { onGrantExtraBreak(u.team, u.uid, u.name); }}>+ Extra korte pauze</button>
          {extra > 0 && <>
            <span className="bm-extra-badge">+{extra} extra</span>
            <button className="bm-btn bm-btn-ghost bm-btn-sm" style={{ color: 'var(--danger)' }}
              onClick={() => { onRemoveExtraBreak(u.team, u.uid, u.name); }}>− Verwijder extra</button>
          </>}
        </div>

        <div className="bm-modal-section-label">Rol</div>
        <div className="bm-modal-row">
          <button
            className={`bm-btn bm-btn-sm ${u.isLeader ? 'bm-btn-primary' : 'bm-btn-ghost'}`}
            disabled={u.uid === me.userId}
            onClick={() => { onAssignLeader(u.uid, u.name, !u.isLeader); onClose(); }}
            title={u.uid === me.userId ? 'Kan eigen rol niet wijzigen' : ''}
          >
            {u.isLeader ? '♛ Admin — klik om te verwijderen' : '♛ Maak admin'}
          </button>
        </div>

        <div className="bm-modal-section-label">Accountbeheer</div>
        <div className="bm-modal-row" style={{ flexWrap: 'wrap' }}>
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={sendPasswordReset} disabled={busy}>
            ✉ Stuur wachtwoord-reset
          </button>
          <button className="bm-btn bm-btn-ghost bm-btn-sm" onClick={exportLogs} disabled={busy}>
            ↓ Exporteer logs (.csv)
          </button>
          {u.uid !== me.userId && (
            <button className="bm-btn bm-btn-sm bm-btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={deleteUser} disabled={busy}>
              🗑 Verwijder gebruiker
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main UsersTable ──────────────────────────────────────────────
export function UsersTable({ state, me, onGrantExtraBreak, onRemoveExtraBreak, onAssignLeader, onAssignTeam, onOpenUserMgmt, notify }) {
  const teams = useTeams();
  const [openModal, setOpenModal] = useState(null); // uid of user whose modal is open

  const sessions = state.sessions || {};
  const totalTime = state.totalTime || {};
  const now = Date.now();
  const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — user appears offline quickly after logout

  // Build from sessions only (not totalTime, which accumulates stale entries)
  // Show user if: seen recently OR currently on break/in queue
  const userIds = new Set(Object.keys(sessions).filter(uid => {
    const s = sessions[uid] || {};
    const lastSeen = s.lastSeen || 0;
    const recentlySeen = now - lastSeen < ACTIVE_THRESHOLD_MS;
    const team = s.team || null;
    const teamData = team ? state.teams[team] : null;
    const onBreak = !!(teamData && teamData.activeBreaks.some(b => b.userId === uid));
    const inQueue = !!(teamData && Object.values(teamData.queues).some(q => q.some(e => e.userId === uid)));
    return recentlySeen || onBreak || inQueue;
  }));

  const usersRaw = Array.from(userIds).map(uid => {
    const s = sessions[uid] || {};
    const t = totalTime[uid] || { brb: 0, short: 0, lunch: 0 };
    const team = s.team || t.team || null;
    const teamData = team ? state.teams[team] : null;
    const usage = teamData?.usage?.[uid] || { short: 0, lunch: 0 };
    const extra = teamData?.extraBreaks?.[uid] || 0;
    const isOnBreak = !!(team && teamData && teamData.activeBreaks.some(b => b.userId === uid));
    const isInQueue = !!(team && teamData && Object.values(teamData.queues).some(q => q.some(e => e.userId === uid)));
    const overtimeTeam = getUserOvertimeTeam(state, uid);
    return {
      uid, name: s.name || t.name || uid.slice(0, 8),
      isLeader: s.isLeader || false, team, isOnBreak, isInQueue,
      extra, overtimeTeam,
      totalMs: (t.brb || 0) + (t.short || 0) + (t.lunch || 0),
      shortUsed: usage.short || 0, lunchUsed: usage.lunch || 0,
      email: '',
    };
  });

  const seenNames = new Map();
  for (const u of usersRaw) { if (!seenNames.has(u.name) || sessions[u.uid]) seenNames.set(u.name, u); }
  const users = Array.from(seenNames.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Grid: naam | pauzes | team | status | laat | tijd | ⋯
  const cols = '1.2fr 110px 120px 90px 130px 70px 48px';

  return (
    <div className="bm-leader-section">
      <h3 className="bm-leader-h3" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span>Gebruikers</span>
        <span className="bm-leader-h3-count">{users.length}</span>
      </h3>
      {users.length === 0 ? <div className="bm-empty">Nog geen gebruikers.</div> : (
        <div className="bm-user-table">
          <div className="bm-user-thead" style={{ gridTemplateColumns: cols }}>
            <span>Naam</span>
            <span>Pauzes</span>
            <span>Team</span>
            <span>Status</span>
            <span>⏰ Laat</span>
            <span>Tijd</span>
            <span></span>
          </div>
          {users.map(u => {
            const teamData = u.team ? state.teams[u.team] : null;
            const nowMs = Date.now();
            const EXPECTED_MS = { brb: 180000, short: 900000, lunch: 1800000 };
            const MIN_SHOW_MS = 5000; // don't show LAAT until 5s over to avoid flicker
            let overMs = 0;
            let isLate = false;

            if (u.overtimeTeam) {
              // Currently on break past their timer — live counter
              const td = state.teams[u.overtimeTeam];
              const b = td?.activeBreaks?.find(x => x.userId === u.uid);
              if (b) {
                const exp = EXPECTED_MS[b.type] || 0;
                overMs = exp > 0 ? Math.max(0, nowMs - (b.startedAt + exp)) : 0;
                isLate = overMs >= MIN_SHOW_MS;
              }
            } else if (state.overrunToday?.[u.uid]) {
              // Returned already but was late — find their last logged overtime
              // Estimate from the overrunToday flag — just show LAAT without time
              isLate = true;
              overMs = 0; // exact time was logged in the break log
            }

            const fmtOver = (ms) => {
              if (!ms) return '';
              const m = Math.floor(ms / 60000);
              const s = Math.floor((ms % 60000) / 1000);
              return m > 0 ? `+${m}m${s > 0 ? `${s}s` : ''}` : `+${s}s`;
            };
            return (
              <div key={u.uid} className={`bm-user-row ${u.isOnBreak ? 'bm-user-on-break' : ''}`} style={{ gridTemplateColumns: cols }}>
                <span className="bm-user-name">
                  {u.isLeader && <span className="bm-user-crown" title="Leider">♛</span>}
                  {u.name}
                  {u.uid === me.userId && <span className="bm-user-badge-you">jij</span>}
                </span>
                <span className="bm-user-breaks" style={{ fontSize: '11px' }}>
                  {u.shortUsed}/{(teamData?.config?.shortPerDay || 2) + u.extra} K · {u.lunchUsed}/{teamData?.config?.lunchPerDay || 1} L
                </span>
                <span>
                  {u.team
                    ? <span className="bm-user-team-pill" style={{ background: getTeamColor(teams, u.team), color: getTeamTextColor(teams, u.team) }}>{getTeamLabel(teams, u.team)}</span>
                    : <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>—</span>
                  }
                </span>
                <span>
                  {u.isOnBreak
                    ? <span className="bm-user-dot bm-user-dot-break">op pauze</span>
                    : u.isInQueue
                    ? <span className="bm-user-dot bm-user-dot-queue">wachtrij</span>
                    : <span className="bm-user-dot bm-user-dot-active">actief</span>
                  }
                </span>
                {/* Laat column — red pill + overtime time if late, empty if not */}
                <span className="bm-user-late-cell">
                  {isLate
                    ? <><span className="bm-admin-late-pill">Laat</span>{overMs > 0 && <span className="bm-admin-overtime" style={{ marginLeft: 5 }}>{fmtOver(overMs)}</span>}</>
                    : null
                  }
                </span>
                <span className="bm-user-time">{fmtMs(u.totalMs)}</span>
                <span className="bm-user-actions" style={{ justifyContent: 'center' }}>
                  <button className="bm-dots-btn" title="Acties"
                    onClick={() => setOpenModal(openModal === u.uid ? null : u.uid)}>
                    ···
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Action modal */}
      {openModal && (() => {
        const u = users.find(x => x.uid === openModal);
        if (!u) return null;
        return (
          <UserActionsModal
            u={u} state={state} me={me}
            onClose={() => setOpenModal(null)}
            onAssignTeam={onAssignTeam}
            onAssignLeader={onAssignLeader}
            onGrantExtraBreak={onGrantExtraBreak}
            onRemoveExtraBreak={onRemoveExtraBreak}
            notify={notify}
          />
        );
      })()}
    </div>
  );
}
