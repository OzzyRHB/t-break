export function Toast({ message, tone }) {
  return (
    <div className={`bm-toast bm-toast-${tone}`} role="status">
      {message}
    </div>
  );
}
