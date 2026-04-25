export function UsageFooter({ myUsage, config, extraBreaks = 0 }) {
  return (
    <footer className="bm-footer">
      Vandaag: <b>{myUsage.short}</b>/{config.shortPerDay + extraBreaks} kort ·{' '}
      <b>{myUsage.lunch}</b>/{config.lunchPerDay} lunch · BRB onbeperkt
      <span className="bm-version">v0.4.018</span>
    </footer>
  );
}
