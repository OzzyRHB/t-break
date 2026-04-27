import { useCallback, useState } from 'react';

// Columns: Team | Naam | Logtekst(1fr) | Type | Eindstatus | Overtijd | Start | Einde | Pauze Tijd | Log Tijd
// STATUS removed, Pauze Tijd added between Einde and Log Tijd

const COL_LABELS  = ['Team', 'Naam', 'Logtekst', 'Type', 'Eindstatus', 'Pauze Tijd', 'Overtijd', 'Start', 'Einde', 'Log Tijd'];
const DEFAULT_WIDTHS = [110,   140,    999,         52,     88,            76,            72,          52,      52,      68];
// index 2 = 1fr (Logtekst)
const FLEX_COL = 2;
const MIN_WIDTH = 36;

// For columns BEFORE the 1fr (0,1): drag right = grow → normal delta.
// For columns AFTER the 1fr (3-9): handle is on the RIGHT edge of the cell.
//   Dragging right grows the column. The 1fr shrinks to compensate, which is correct.
//   BUT visually the right-side column appears to grow leftward (its right edge stays fixed
//   at the panel edge). So we INVERT the delta for post-flex columns.
const IS_POST_FLEX = (i) => i > FLEX_COL;

export function useResizableCols() {
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);

  const startDrag = useCallback((colIndex, e) => {
    e.preventDefault();
    const startX    = e.clientX;
    const startW    = widths[colIndex];
    const invert    = IS_POST_FLEX(colIndex);

    const onMove = (ev) => {
      const raw   = ev.clientX - startX;
      const delta = invert ? -raw : raw;
      setWidths(prev => {
        const next = [...prev];
        next[colIndex] = Math.max(MIN_WIDTH, startW + delta);
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

  const gridTemplate = widths
    .map((w, i) => i === FLEX_COL ? '1fr' : `${w}px`)
    .join(' ');

  return { widths, gridTemplate, startDrag };
}

export function LogHeader({ gridTemplate, startDrag }) {
  return (
    <div className="bm-log-header" style={{ gridTemplateColumns: gridTemplate }}>
      {COL_LABELS.map((label, i) => (
        <div key={i} className="bm-log-header-cell">
          <span className="bm-log-header-label">{label}</span>
          {/* No handle on the 1fr col or the last col */}
          {i !== FLEX_COL && i < COL_LABELS.length - 1 && (
            <div
              className="bm-col-resize-handle"
              onMouseDown={(e) => startDrag(i, e)}
              title="Sleep om kolom aan te passen"
            />
          )}
        </div>
      ))}
    </div>
  );
}
