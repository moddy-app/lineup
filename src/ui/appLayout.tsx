import type {HTMLAttributes, ReactNode} from 'react';

import {cx} from '@/lib/cx';

import {Card, type CardProps} from './Card';
import {Page} from './layout';

/**
 * Layouts for functional screens (feed, lists, forms, profiles, staff tables).
 *
 * The bento grid (full 12-column rows, one idea per card, a shape in each
 * card) is the look of the brand and of marketing-style pages. It is not
 * forced on screens people work in: these primitives give them ordinary app
 * layouts on the same tokens (page gap, cards on surface-container-lowest,
 * edge-caps corners).
 */

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'className'> & {className?: string};

interface AppLayoutProps extends DivProps {
  /** A side column (filters, a summary, related items). Under the main column on a narrow window. */
  aside?: ReactNode;
  /** Keep the side column in view while the main column scrolls. */
  stickyAside?: boolean;
}

/**
 * The page: a main column and, optionally, a side column, separated by the page
 * gap. Cards go in each column (a Stack is not needed: columns space them).
 */
export function AppLayout({aside, stickyAside, className, children, ...props}: AppLayoutProps) {
  return (
    <Page>
      <div {...props} className={cx('app-layout', aside ? 'has-aside' : false, className)}>
        <div className="app-main">{children}</div>
        {aside && <aside className={cx('app-aside', stickyAside && 'sticky')}>{aside}</aside>}
      </div>
    </Page>
  );
}

/** A narrow column (760px at most), centered: a form, a settings page, one document. */
export function SingleColumn({className, ...props}: DivProps) {
  return (
    <Page>
      <div {...props} className={cx('single-column', className)} />
    </Page>
  );
}

type SectionProps = Omit<Extract<CardProps, {as?: 'section' | 'article' | 'div'}>, 'children' | 'variant' | 'span'> & {
  title: ReactNode;
  /** `1` for the heading of the whole page (one per page); `2` for a section of it. Same size. */
  level?: 1 | 2;
  /** Buttons on the right of the title row. */
  actions?: ReactNode;
  children?: ReactNode;
};

/** A card with a title row (title, actions on the right) and its content below. */
export function Section({title, level = 2, actions, className, children, ...props}: SectionProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <Card {...props} className={cx('section', className)}>
      <div className="section-head">
        <Heading>{title}</Heading>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {children}
    </Card>
  );
}
