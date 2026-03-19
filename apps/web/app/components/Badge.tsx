type BadgeVariant = 'neutral' | 'success' | 'warning' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export default function Badge({ label, variant = 'neutral' }: BadgeProps) {
  return <span className={`badge ${variant}`.trim()}>{label}</span>;
}
