import { useEffect, useRef, useState } from 'react';
import { AuthScreen } from './auth/AuthScreen';
import { Header } from './components/Header';
import { ActiveTicket } from './components/ActiveTicket';
import { QueueBanner } from './components/QueueBanner';
import { OfferTicket } from './components/OfferTicket';
import { TicketRow } from './components/TicketRow';
import { Toast } from './components/Toast';
import { UsageFooter } from './components/UsageFooter';
import { LeaderPanel } from './leader/LeaderPanel';
import { TeamSection } from './leader/TeamSection';
import { UserManagement } from './leader/UserManagement';
import { useAuth } from './hooks/useAuth';
import { useAppState } from './hooks/useAppState';
import { useAdminData } from './hooks/useAdminData';
import { TYPES } from './lib/constants';
import { useTeams, getTeamIds, getTeamLabel, getTeamColor, getTeamTextColor } from './lib/TeamsContext';
import { todayStr } from './lib/helpers';

export default function App() {
  const { me, setMe, authChecked, signOut, toggleLeader } = useAuth();
  const [toast, setToast] = useState(null);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  const [isEmployeeView, setIsEmployeeView] = useState(false);

  const notify = (message, tone = 'info') => setToast({ message, tone });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const teams = useTeams();
  const appState = useAppState(me, setMe, notify, teams);
  const {
    state, act,
    takeTicket, joinQueue, leaveQueue,
    endMyBreak, endBreakFor, startBreakFor,
    claimOffer, declineOffer,
    updateConfig, setDefaultConfig, loadDefaultConfig,
    grantExtraBreak, removeExtraBreak,
    assignLeader, assignTeam, resetAll, clearLog,
    requestTeamSwitch,
  } = appState;

  const admin = useAdminData(me, notify);

  // Employee-derived state
  const myTeam = me?.team || null;
  const myTeamData = (myTeam && state?.teams?.[myTeam]) ? state.teams[myTeam] : null;
  const myActive = myTeamData ? myTeamData.activeBreaks.find((b) => b.userId === me.userId) : null;
  const myQueueType = myTeamData
    ? Object.keys(TYPES).find((t) => myTeamData.queues[t].some((q) => q.userId === me?.userId))
    : null;
  const myOffer = myTeamData && myQueueType
    ? (() => {
        const e = myTeamData.queues[myQueueType].find((q) => q.userId === me.userId);
        return e?.offeredAt ? { type: myQueueType, offeredAt: e.offeredAt } : null;
      })()
    : null;
  const myUsage = myTeamData
    ? myTeamData.usage[me.userId] || { date: todayStr(), short: 0, lunch: 0 }
    : { date: todayStr(), short: 0, lunch: 0 };
  const myExtraBreaks = myTeamData ? myTeamData.extraBreaks[me?.userId] || 0 : 0;

  // Offer notification
  const notifiedOfferRef = useRef(null);
  useEffect(() => {
    if (!myOffer) { notifiedOfferRef.current = null; return; }
    const key = `${myOffer.type}-${myOffer.offeredAt}`;
    if (notifiedOfferRef.current === key) return;
    notifiedOfferRef.current = key;
    notify('Ticket beschikbaar! Tik om te claimen.', 'ok');
    const send = () => {
      try {
        new Notification('T-Break — Ticket beschikbaar', {
          body: `Jouw ${TYPES[myOffer.type].full} ticket is klaar.`,
          tag: 'tbreak-offer',
        });
      } catch {}
    };
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') send();
      else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((p) => { if (p === 'granted') send(); });
      }
    }
  }, [myOffer]);

  if (!authChecked) {
    return (
      <div className="bm-root bm-center">
        <div className="bm-loading">Laden…</div>
      </div>
    );
  }
  if (!me) return <AuthScreen onAuth={setMe} />;

  // Wait for state to initialize before rendering anything that accesses state.teams
  if (!state?.teams) {
    return (
      <div className="bm-root bm-center">
        <div className="bm-loading">Laden…</div>
      </div>
    );
  }

  return (
    <div className="bm-root">
      <Header
        me={me}
        onSignOut={signOut}
        onToggleLeader={() => setIsEmployeeView(v => !v)}
        isEmployeeView={isEmployeeView}
        notify={notify}
        teams={teams}
        myTeam={myTeam}
        onRequestTeamSwitch={requestTeamSwitch}
      />
      <main className="bm-main">
        {myActive && myTeamData && (
          <ActiveTicket myBreak={myActive} config={myTeamData.config} onEnd={endMyBreak} />
        )}
        {!myActive && myQueueType && !myOffer && myTeamData && (
          <QueueBanner
            type={myQueueType}
            queue={myTeamData.queues[myQueueType]}
            userId={me.userId}
          />
        )}
        {myOffer && !myActive && (
          <OfferTicket
            type={myOffer.type}
            offeredAt={myOffer.offeredAt}
            onClaim={() => claimOffer(myOffer.type)}
            onDecline={() => declineOffer(myOffer.type)}
          />
        )}

        {/* No team assigned — warning + self-assign options */}
        {!me.isLeader && !myTeam && (
          <div className="bm-no-team">
            Je bent nog niet aan een team toegewezen. Kies hieronder je team of wacht op de
            teamleider.
            <div className="bm-no-team-btns">
              {getTeamIds(teams).map((t) => (
                <button
                  key={t}
                  className="bm-btn bm-btn-ghost"
                  onClick={() => requestTeamSwitch(t)}
                >
                  {getTeamLabel(teams, t)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`bm-content ${me.isLeader && !isEmployeeView ? 'bm-content-leader' : ''}`}>
          <div className={`bm-rows ${myActive ? 'bm-rows-dim' : ''}`}>
            {me.isLeader && !isEmployeeView ? (
              getTeamIds(teams).filter(t => state.teams?.[t]).map((team) => (
                <TeamSection key={team} team={team} teamData={state.teams[team]} me={me} compact />
              ))
            ) : myTeam ? (
              <>
                <div
                  className="bm-team-label-pill"
                  style={{
                    background: getTeamColor(teams, myTeam),
                    color: getTeamTextColor(teams, myTeam),
                  }}
                >
                  {getTeamLabel(teams, myTeam)}
                </div>
                {myTeamData ? Object.keys(TYPES).map((type) => (
                  <TicketRow
                    key={type}
                    type={type}
                    state={myTeamData}
                    me={me}
                    myActive={myActive}
                    myQueueType={myQueueType}
                    myOffer={myOffer}
                    myUsage={myUsage}
                    myExtraBreaks={myExtraBreaks}
                    onTake={() => takeTicket(type)}
                    onJoin={() => joinQueue(type)}
                    onLeave={() => leaveQueue(type)}
                    onClaim={() =>
                      myOffer && myOffer.type === type ? claimOffer(type) : undefined
                    }
                  />
                )) : <div className="bm-loading" style={{ padding: '20px 0' }}>Laden…</div>}
              </>
            ) : null}
          </div>

          {me.isLeader && !isEmployeeView && (
            <aside className="bm-leader-aside">
              {userMgmtOpen ? (
                <UserManagement
                  state={state}
                  me={me}
                  onAssignLeader={assignLeader}
                  onAssignTeam={assignTeam}
                  onGrantExtraBreak={grantExtraBreak}
                  onRemoveExtraBreak={removeExtraBreak}
                  onBack={() => setUserMgmtOpen(false)}
                  notify={notify}
                />
              ) : (
                <LeaderPanel
                  state={state}
                  me={me}
                  onUpdateConfig={updateConfig}
                  onEndBreak={endBreakFor}
                  onStartBreak={startBreakFor}
                  onReset={resetAll}
                  onClearLog={clearLog}
                  onGrantExtraBreak={grantExtraBreak}
                  onRemoveExtraBreak={removeExtraBreak}
                  onAssignLeader={assignLeader}
                  onAssignTeam={assignTeam}
                  onSetDefault={setDefaultConfig}
                  onLoadDefault={loadDefaultConfig}
                  pendingUsers={admin.pendingUsers}
                  teamRequests={admin.teamRequests}
                  onApprove={(id, makeLeader) => admin.approveUser(id, makeLeader, act)}
                  onApproveTeam={(req) => admin.approveTeamRequest(req, act)}
                  onDenyTeam={admin.denyTeamRequest}
                  onOpenUserMgmt={() => setUserMgmtOpen(true)}
                  notify={notify}
                />
              )}
            </aside>
          )}
        </div>

        {myTeam && myTeamData && (
          <UsageFooter
            myUsage={myUsage}
            config={myTeamData.config}
            extraBreaks={myExtraBreaks}
          />
        )}
      </main>
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
