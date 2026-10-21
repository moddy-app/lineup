/**
 * Nothing to show yet: a shape, a title, one sentence, optionally an action.
 * Alone it is a card; `compact` is a quiet band to put inside a Section.
 */

import type {ReactNode} from 'react';

import {Card, CardActions, Shape, type ShapeName, type ShapeTone} from '@/ui';

interface EmptyStateProps {
  /** Material Symbol in the shape. */
  icon: string;
  title: string;
  /** The one sentence. */
  children?: ReactNode;
  /** A button (md-filled-button, LinkButton…). */
  action?: ReactNode;
  shape?: ShapeName;
  tone?: ShapeTone;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  shape = 'hexagon',
  tone = 'secondary',
  compact,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div className="empty-state compact">
        <Shape shape={shape} tone={tone} icon={icon} small />
        <div className="empty-state-text">
          <h3>{title}</h3>
          {children && <p>{children}</p>}
        </div>
        {action && <div className="empty-state-action">{action}</div>}
      </div>
    );
  }
  return (
    <Card className="empty-state">
      <Shape shape={shape} tone={tone} icon={icon} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <CardActions>{action}</CardActions>}
    </Card>
  );
}
