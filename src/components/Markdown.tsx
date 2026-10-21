import type {ComponentProps} from 'react';
import ReactMarkdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {cx} from '@/lib/cx';

import {isSafeUrl} from './markdownUrl';

/** react-markdown's default would keep relative and other schemes: we decide in `a`, so keep nothing unsafe. */
const urlTransform = (url: string) => (isSafeUrl(url) ? url : '');

type Props<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & {node?: unknown};

/** A person's headings never make a big title: h1 to h3 are one visual level, h4 to h6 the next. */
const heading =
  (Tag: 'h3' | 'h4') =>
  ({node: _node, ...props}: Props<'h3'>) => <Tag {...props} />;

const components: Components = {
  h1: heading('h3'),
  h2: heading('h3'),
  h3: heading('h3'),
  h4: heading('h4'),
  h5: heading('h4'),
  h6: heading('h4'),
  a: ({node: _node, href, children}: Props<'a'>) =>
    isSafeUrl(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
  // Images are never loaded (tracking, huge files, inappropriate content): the description stands in.
  img: ({alt}: Props<'img'>) => (alt ? <>{alt}</> : null),
};

/** Elements dropped from the output (their text is kept): tables overflow narrow screens, inputs are task-list boxes. */
const DISALLOWED = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'input'];

interface MarkdownProps {
  /** The Markdown source, written by a person: treated as untrusted. */
  children: string;
  className?: string;
}

/**
 * Renders a person's Markdown safely: no raw HTML, links only to http(s) and
 * mailto (new tab, `noopener noreferrer nofollow`), images replaced by their
 * description, headings brought down to the size of a section title.
 */
export function Markdown({children, className}: MarkdownProps) {
  return (
    <div className={cx('markdown', className)}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={urlTransform}
        disallowedElements={DISALLOWED}
        unwrapDisallowed
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
