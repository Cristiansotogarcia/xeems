interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: string;
  loading?: boolean;
}

export default function StatCard({ label, value, note, icon, loading }: StatCardProps) {
  return (
    <div className="card stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="stat-value">{loading ? '…' : value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}
