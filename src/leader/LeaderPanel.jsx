import { useState } from 'react';
import { PendingApprovals } from './PendingApprovals';
import { TeamControls } from './TeamControls';
import { UsersTable } from './UsersTable';
import { AdminActiveRow } from './AdminActiveRow';
import { CalendarButton, ArchiveViewer, LogToday } from './ArchiveViewer';
import { TeamEditorModal } from './TeamEditor';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor } from '../lib/TeamsContext';

export function LeaderPanel({
  state, me,
  onUpdateConfig, onEndBreak, onReset, onClearLog,
  onGrantExtraBreak, onRemoveExtraBreak,
  onAssignLeader, onAssignTeam,
  onSetDefault, onLoadDefault,
  pendingUsers, teamRequests,
  onApprove, onApproveTeam, onDenyTeam,
  onOpenUserMgmt, notify,
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearLog, setConfirmClearLog] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [archiveDate, setArchiveDate] = useState(null);
  const [archiveLog, setArchiveLog] = useState(null);
  const [teamsEditOpen, setTeamsEditOpen] = useState(false);
  const teams = useTeams();

  // Only iterate teams that actually exist in state.teams to avoid crashes
  // during the brief moment before state syncs from Supabase
  const activeTeamIds = getTeamIds(teams).filter(t => state.teams?.[t]);

  return (
    <section className="bm-leader">
      <div className="bm-leader-header">
        <span className="bm-leader-eyebrow">Admin Panel</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Edit Teams */}
          <button className="bm-cal-btn" onClick={() => setTeamsEditOpen(true)} title="Teams beheren">
            <svg className="bm-cal-btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
            </svg>
            Teams
          </button>
          {/* Gebruikersbeheer */}
          {onOpenUserMgmt && (
            <button className="bm-cal-btn" onClick={onOpenUserMgmt} title="Gebruikersbeheer">
              <svg className="bm-cal-btn-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <circle cx="8" cy="5" r="3"/>
                <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/>
              </svg>
              Gebruikers
            </button>
          )}
          {/* Kalender */}
          <CalendarButton
            onOpenArchive={(d, log) => { setArchiveDate(d); setArchiveLog(log); }}
            notify={notify}
          />
          {/* Ticket controls toggle */}
          <button
            className={`bm-cal-btn ${controlsOpen ? 'bm-cal-btn-active' : ''}`}
            onClick={() => setControlsOpen((v) => !v)}
            title={controlsOpen ? 'Verberg ticketcontroles' : 'Toon ticketcontroles'}
          >
            <svg className="bm-cal-btn-icon" viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
              {controlsOpen
                ? <path d="M8 4l6 8H2z"/>
                : <path d="M8 12L2 4h12z"/>
              }
            </svg>
            Tickets
          </button>
        </div>
      </div>

      <div className="bm-leader-body">
        <PendingApprovals
          pendingUsers={pendingUsers}
          teamRequests={teamRequests}
          onApprove={onApprove}
          onApproveTeam={onApproveTeam}
          onDenyTeam={onDenyTeam}
        />

        <TeamControls
          state={state}
          onUpdateConfig={onUpdateConfig}
          onSetDefault={onSetDefault}
          onLoadDefault={onLoadDefault}
          visible={controlsOpen}
        />

        {/* Nu op pauze */}
        <div className="bm-leader-section">
          <h3 className="bm-leader-h3">Nu op pauze</h3>
          {activeTeamIds.every((t) => state.teams[t].activeBreaks.length === 0) ? (
            <div className="bm-empty">Niemand op pauze.</div>
          ) : (
            activeTeamIds.map((team) =>
              state.teams[team].activeBreaks.length > 0 && (
                <div key={team} className="bm-team-break-group">
                  <div className="bm-team-break-label" style={{ color: getTeamColor(teams, team) }}>
                    {getTeamLabel(teams, team)}
                  </div>
                  <ul className="bm-admin-list">
                    {state.teams[team].activeBreaks.map((b) => (
                      <AdminActiveRow
                        key={b.id}
                        b={b}
                        config={state.teams[team].config}
                        onEnd={() => onEndBreak(b.id, team)}
                      />
                    ))}
                  </ul>
                </div>
              )
            )
          )}
        </div>

        <UsersTable
          state={state}
          me={me}
          onGrantExtraBreak={onGrantExtraBreak}
          onRemoveExtraBreak={onRemoveExtraBreak}
          onAssignLeader={onAssignLeader}
          onAssignTeam={onAssignTeam}
          onOpenUserMgmt={onOpenUserMgmt}
          notify={notify}
        />

        <ArchiveViewer
          date={archiveDate}
          log={archiveLog}
          onClose={() => { setArchiveDate(null); setArchiveLog(null); }}
          notify={notify}
        />

        <LogToday log={state.log} />

        <div className="bm-leader-footer">
          {confirmReset ? (
            <div className="bm-reset-confirm">
              <span>Verwijdert alle gegevens voor iedereen. Zeker?</span>
              <button className="bm-btn bm-btn-danger"
                onClick={() => { onReset(); setConfirmReset(false); }}>
                Ja, resetten
              </button>
              <button className="bm-btn bm-btn-ghost" onClick={() => setConfirmReset(false)}>
                Annuleren
              </button>
            </div>
          ) : confirmClearLog ? (
            <div className="bm-reset-confirm">
              <span>Logboek van vandaag wissen? Archief blijft behouden.</span>
              <button className="bm-btn bm-btn-danger"
                onClick={() => { onClearLog(); setConfirmClearLog(false); }}>
                Ja, wissen
              </button>
              <button className="bm-btn bm-btn-ghost" onClick={() => setConfirmClearLog(false)}>
                Annuleren
              </button>
            </div>
          ) : (
            <>
              <button className="bm-cal-btn" onClick={() => setConfirmReset(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 1 0 1-3"/><path d="M3 3v3h3"/></svg>
                Alles resetten
              </button>
              <button className="bm-cal-btn" onClick={() => setConfirmClearLog(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h10m-8 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1m-7 0 1 8h6l1-8"/></svg>
                Logboek wissen
              </button>
            </>
          )}
        </div>
      </div>

      {teamsEditOpen && (
        <TeamEditorModal state={state} onClose={() => setTeamsEditOpen(false)} notify={notify} />
      )}
    </section>
  );
}
