import { TYPES } from '../lib/constants';
import { fmt, fmtMs } from '../lib/helpers';

export function AdminActiveRow({ b, config, onEnd }) {
  const dur = config[TYPES[b.type].durKey];
  const endAt = b.startedAt + dur * 1000;
  const now = Date.now();
  const remaining = Math.max(0, Math.round((endAt - now) / 1000));
  const over = now > endAt;
  const overBy = over ? now - endAt : 0;
  return (
    <li className={`bm-admin-row ${over ? 'bm-admin-row-over' : ''}`}>
      <span className="bm-admin-name">{b.userName}</span>
      <span className={`bm-admin-type bm-admin-type-${b.type}`}>{TYPES[b.type].label}</span>
      <span className="bm-admin-time">
        {over ? `+${fmtMs(overBy)} overtijd` : `${fmt(remaining)} resterend`}
      </span>
      <button className="bm-btn bm-btn-xs bm-btn-ghost" onClick={onEnd}>
        Beëindig
      </button>
    </li>
  );
}
