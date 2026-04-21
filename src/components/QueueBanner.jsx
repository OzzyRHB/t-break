import { TYPES } from '../lib/constants';

export function QueueBanner({ type, queue, userId }) {
  const pos = queue.findIndex((q) => q.userId === userId) + 1;
  if (pos === 0) return null;
  const def = TYPES[type];
  const ahead = pos - 1;
  return (
    <div className="bm-queue-banner">
      <div className="bm-queue-banner-left">
        <div className="bm-queue-banner-label">In de wachtrij</div>
        <div className="bm-queue-banner-type">{def.full}</div>
        <div className="bm-queue-banner-pos">
          {ahead === 0
            ? 'Jij bent als eerste aan de beurt'
            : `Positie #${pos} · ${ahead} voor jou`}
        </div>
      </div>
      <div className={`bm-queue-banner-pill bm-queue-banner-pill-${type}`}>#{pos}</div>
    </div>
  );
}
