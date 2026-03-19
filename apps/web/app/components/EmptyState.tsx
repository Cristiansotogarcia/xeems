import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div>{message}</div>
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}
