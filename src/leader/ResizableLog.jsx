import { useCallback, useRef, useState } from 'react';

// Default column widths in px
// Index 2 (Logtekst) is the 1fr column — its value here is ignored for the grid
// but kept so the widths array stays index-aligned with COL_LABELS.
const DEFAULT_WIDTHS = [110, 140, 999, 52, 80, 80, 68, 50, 50, 52];

const COL_LABELS = ['Team', 'Naam', 'Logtekst', 'Type', 'Status', 'Eindstatus', 'Overtijd', 'Start', 'Einde', 'Tijd'];
const FLEX_COL = 2; // index of the 1fr column
const MIN_WIDTH = 36;

// Boundaries where a resize handle lives (between col i and col i+1).
// We skip the boundary just before the 1fr (between Naam and Logtekst, index 1→2)
// and just after the 1fr (between Logtekst and Type, index 2→3) because:
//   • Dragging the Naam/Logtekst boundary would resize the 1fr implicitly — confusing.
//   • The Type handle at index 3 already controls that gap.
// Resizable boundaries: 0→1, 3→4, 4→5, 5→6, 6→7, 7→8, 8→9
// Each handle controls widths[leftColIndex] for pre-flex cols,
// and widths[rightColIndex] for post-flex cols (inverted drag).
const HANDLES = [
  { boundary: 1, controls: 0, invert: false },  // right edge of Team   → resize Team
  { boundary: 2, controls: 1, invert: false },  // right edge of Naam   → resize Naam
  // no handle at boundary 3 (Logtekst/Type) — Type's left handle covers it
  { boundary: 4, controls: 3, invert: true  },  // left edge of Type     → resize Type
  { boundary: 5, controls: 4, invert: true  },  // left edge of Status   → resize Status
  { boundary: 6, controls: 5, invert: true  },  // left edge of Eindstatus
  { boundary: 7, controls: 6, invert: true  },  // left edge of Overtijd
  { boundary: 8, controls: 7, invert: true  },  // left edge of Start
  { boundary: 9, controls: 8, invert: true  },  // left edge of Einde
  // No handle after Tijd (last column)
];

export function useResizableCols() {
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);

  const startDrag = useCallback((controls, invert, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[controls];

    const onMove = (ev) => {
      const raw = ev.clientX - startX;
      const delta = invert ? -raw : raw;
      setWidths(prev => {
        const next = [...prev];
        next[controls] = Math.max(MIN_WIDTH, startWidth + delta);
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

// Compute cumulative left offsets for each boundary from the widths array.
// The 1fr column's rendered width is unknown at JS time, so we measure it via a ref.
export function LogHeader({ gridTemplate, startDrag }) {
  const headerRef = useRef(null);

  const getHandleLeft = (boundary) => {
    // Sum fixed-width columns before this boundary.
    // For boundaries after the 1fr, we need the actual rendered width of the header.
    // We return a CSS calc() string instead.
    const pre  = DEFAULT_WIDTHS.slice(0, boundary).filter((_, i) => i !== FLEX_COL);
    const post = DEFAULT_WIDTHS.slice(boundary).filter((_, i) => i + boundary !== FLEX_COL);
    // Use right: offset from the right for post-flex handles
    return null; // signal to use right-based positioning
  };

  return (
    <div className="bm-log-header" style={{ gridTemplateColumns: gridTemplate }} ref={headerRef}>
      {COL_LABELS.map((label, i) => (
        <div key={i} className="bm-log-header-cell">
          <span>{label}</span>
        </div>
      ))}
      {/* Overlay handles — one per resizable boundary, positioned via grid */}
      <div className="bm-log-handle-layer" style={{ gridTemplateColumns: gridTemplate }}>
        {HANDLES.map(({ boundary, controls, invert }) => (
          <div
            key={boundary}
            className="bm-log-handle-slot"
            style={{ gridColumn: boundary }} // sits at the right edge of column `boundary`
          >
            <div
              className="bm-col-resize-handle"
              onMouseDown={(e) => startDrag(controls, invert, e)}
              title="Sleep om kolom te verbreden"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
