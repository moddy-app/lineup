import {Section, SingleColumn} from '@/ui';

/**
 * What every page shows until its feature is built: its name, in a card. A
 * feature replaces its page module's component and drops this. Functional
 * pages use AppLayout / SingleColumn / Section, not the bento grid.
 */
export function PagePlaceholder({title}: {title: string}) {
  return (
    <SingleColumn>
      <Section title={title} level={1} />
    </SingleColumn>
  );
}
