export function Progress({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold">
        <span>{label}</span><span>{done}/{total} · {pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-teal' : 'bg-saffron'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
export const Badge = ({ ok, children }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ok ? 'bg-teal/15 text-teal' : 'bg-saffron/20 text-[#8a5d00]'}`}>{children}</span>
);
export const ErrorMsg = ({ msg }) => msg ? <p role="alert" className="rounded-md bg-brick/10 px-3 py-2 text-sm font-medium text-brick">{msg}</p> : null;
export const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
