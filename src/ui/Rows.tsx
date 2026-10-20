import {createContext, type HTMLAttributes, type ReactNode, use} from 'react';
import {Link, type LinkProps} from 'react-router';

import {cx} from '@/lib/cx';

/** Whether the rows sit in a <ul>: each Row is then a <li>. */
const ListContext = createContext(false);

interface RowsProps extends Omit<HTMLAttributes<HTMLElement>, 'className'> {
  /** `ul` when the rows are a real list (an experience list, search results). */
  as?: 'div' | 'ul';
  className?: string;
}

/** A list of rows: a shape or an avatar, two lines of text, a status. */
export function Rows({as = 'div', className, ...props}: RowsProps) {
  const Tag = as;
  return (
    <ListContext value={as === 'ul'}>
      <Tag {...props} className={cx('rows', className)} />
    </ListContext>
  );
}

type PlainRowProps = Omit<HTMLAttributes<HTMLElement>, 'className'> & {
  className?: string;
  to?: undefined;
};
type LinkRowProps = Omit<LinkProps, 'className'> & {className?: string};

/** One row. With `to` it is a link (client-side) that reacts to the pointer. */
export function Row(props: PlainRowProps | LinkRowProps) {
  const inList = use(ListContext);
  if (props.to !== undefined) {
    const {className, ...rest} = props;
    const link = <Link {...rest} className={cx('row', className)} />;
    return inList ? <li>{link}</li> : link;
  }
  const {className, ...rest} = props;
  const Tag = inList ? 'li' : 'div';
  return <Tag {...rest} className={cx('row', className)} />;
}

interface RowBodyProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Mono metadata: an id, a stamp, something the person did not write. */
  mono?: boolean;
}

/** The two text lines of a row. */
export function RowBody({title, meta, mono}: RowBodyProps) {
  return (
    <div className="row-body">
      <span className="row-title">{title}</span>
      {meta != null && <span className={cx('row-meta', mono && 'mono')}>{meta}</span>}
    </div>
  );
}
