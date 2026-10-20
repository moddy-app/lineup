import {Bento, Card, Page} from '@/ui';

/**
 * What every page shows until its feature is built: its name, in a card. A
 * feature replaces its page module's component and drops this.
 */
export function PagePlaceholder({title}: {title: string}) {
  return (
    <Page>
      <Bento>
        <Card variant="hero">
          <h1>{title}</h1>
        </Card>
      </Bento>
    </Page>
  );
}
