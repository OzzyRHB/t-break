import { useState } from 'react';
import { TEAMS, TEAM_LABELS, TEAM_COLORS } from '../lib/constants';
import { PendingApprovals } from './PendingApprovals';
import { TeamControls } from './TeamControls';
import { UsersTable } from './UsersTable';
import { AdminActiveRow } from './AdminActiveRow';
import { CalendarButton, ArchiveViewer, LogToday } from './ArchiveViewer';

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

  return (
    <section className="bm-leader">
      <div className="bm-leader-header">
        <span className="bm-leader-eyebrow">Admin Panel</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <CalendarButton
            onOpenArchive={(d, log) => { setArchiveDate(d); setArchiveLog(log); }}
          />
          <button
            className={`bm-cal-btn ${controlsOpen ? '' : 'bm-cal-btn-active'}`}
            onClick={() => setControlsOpen((v) => !v)}
            title={controlsOpen ? 'Verberg ticketcontroles' : 'Toon ticketcontroles'}
          >
            {controlsOpen ? '▲' : '▼'}
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

        {/* On break now — all teams */}
        <div className="bm-leader-section">
          <h3 className="bm-leader-h3">Nu op pauze</h3>
          {TEAMS.every((t) => state.teams[t].activeBreaks.length === 0) ? (
            <div className="bm-empty">Niemand op pauze.</div>
          ) : (
            TEAMS.map(
              (team) =>
                state.teams[team].activeBreaks.length > 0 && (
                  <div key={team} className="bm-team-break-group">
                    <div
                      className="bm-team-break-label"
                      style={{ color: TEAM_COLORS[team] }}
                    >
                      {TEAM_LABELS[team]}
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
        />

        <LogToday log={state.log} />

        <div className="bm-leader-footer">
          {confirmReset ? (
            <div className="bm-reset-confirm">
              <span>Verwijdert alle gegevens voor iedereen. Zeker?</span>
              <button
                className="bm-btn bm-btn-danger"
                onClick={() => { onReset(); setConfirmReset(false); }}
              >
                Ja, resetten
              </button>
              <button className="bm-btn bm-btn-ghost" onClick={() => setConfirmReset(false)}>
                Annuleren
              </button>
            </div>
          ) : confirmClearLog ? (
            <div className="bm-reset-confirm">
              <span>Logboek van vandaag wissen? Archief blijft behouden.</span>
              <button
                className="bm-btn bm-btn-danger"
                onClick={() => { onClearLog(); setConfirmClearLog(false); }}
              >
                Ja, wissen
              </button>
              <button className="bm-btn bm-btn-ghost" onClick={() => setConfirmClearLog(false)}>
                Annuleren
              </button>
            </div>
          ) : (
            <>
              <button className="bm-btn bm-btn-ghost" onClick={() => setConfirmReset(true)}>
                Alles resetten
              </button>
              <button className="bm-btn bm-btn-ghost" onClick={() => setConfirmClearLog(true)}>
                Logboek wissen
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
