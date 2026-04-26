import { useCallback, useState } from 'react';

const DEFAULT_WIDTHS = [110, 140, 999, 52, 80, 80, 68, 50, 50, 52];
// Index 2 (Logtekst) is 1fr — its stored value is unused in the grid string.

const COL_LABELS = ['Team', 'Naam', 'Logtekst', 'Type', 'Status', 'Eindstatus', 'Overtijd', 'Start', 'Einde', 'Tijd'];
const FLEX_COL = 2;
const MIN_WIDTH = 36;

export function useResizableCols() {
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);

  // Handle is always on the RIGHT edge of the column.
  // Pre-flex cols (i < FLEX_COL): drag right → col grows, 1fr shrinks. Delta positive = grow. ✓
  // Post-flex cols (i > FLEX_COL): drag right → right boundary moves right → col SHRINKS
  //   (the space to its right has nowhere to go since the last col is fixed).
  //   So for post-flex, drag right = shrink = invert delta.
  const startDrag = useCallback((colIndex, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[colIndex];
    const invert = colIndex > FLEX_COL;

    const onMove = (ev) => {
      const raw = ev.clientX - startX;
      const delta = invert ? -raw : raw;
      setWidths(prev => {
        const next = [...prev];
        next[colIndex] = Math.max(MIN_WIDTH, startWidth + delta);
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [widths]);

  const gridTemplate = widths.map((w, i) => i === FLEX_COL ? '1fr' : `${w}px`).join(' ');

  return { widths, gridTemplate, startDrag };
}

export function LogHeader({ gridTemplate, startDrag }) {
  return (
    <div className="bm-log-header" style={{ gridTemplateColumns: gridTemplate }}>
      {COL_LABELS.map((label, i) => (
        <div key={i} className="bm-log-header-cell">
          <span className="bm-log-header-label">{label}</span>
          {/* Handle on right edge — all cols except last.
               On the 1fr col, the handle controls col 3 (Type) with inverted drag. */}
          {i < COL_LABELS.length - 1 && (
            <div
              className="bm-col-resize-handle"
              onMouseDown={(e) => startDrag(i === FLEX_COL ? FLEX_COL + 1 : i, e)}
              title="Sleep om kolom te verbreden"
            />
          )}
        </div>
      ))}
    </div>
  );
}
