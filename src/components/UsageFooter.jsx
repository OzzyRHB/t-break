export function UsageFooter({ myUsage, config, extraBreaks = 0 }) {
  return (
    <footer className="bm-footer">
      Vandaag: <b>{myUsage.short}</b>/{config.shortPerDay + extraBreaks} kort ·{' '}
      <b>{myUsage.lunch}</b>/{config.lunchPerDay} lunch · BRB onbeperkt
      <span className="bm-version">v0.4.002</span>
    </footer>
  );
}

export function TeamSection({ team, teamData, me, compact = true, TEAM_COLORS, TEAM_LABELS }) {
  // This is a legacy helper — kept minimal, admin view uses compact TicketRow per team
  return null;
}
