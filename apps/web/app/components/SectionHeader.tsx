import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="card-header">
      <div>
        <div className="card-title">{title}</div>
        {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}
