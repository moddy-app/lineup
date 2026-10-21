import {render, screen} from '@testing-library/react';
import {beforeAll, describe, expect, it} from 'vitest';

import {useFrench} from '@/test/harness';

import {ConfirmDialog, Dialog} from './Dialog';

beforeAll(useFrench);

describe('Dialog', () => {
  it('renders the md-dialog under <body>, outside the tree it is declared in', () => {
    const {container} = render(
      <section className="card">
        <Dialog open onClose={() => {}} headline="Titre" actions={<button type="button">Ok</button>}>
          Corps
        </Dialog>
      </section>,
    );
    const dialog = document.querySelector('md-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.parentElement).toBe(document.body);
    expect(container.querySelector('md-dialog')).toBeNull();
    expect(screen.getByText('Corps')).toBeTruthy();
    expect(dialog?.querySelector('[slot="headline"]')?.textContent).toBe('Titre');
  });

  it('ConfirmDialog goes through it too', () => {
    render(
      <ConfirmDialog
        open
        title="Supprimer ?"
        body="Sûr ?"
        confirmLabel="Supprimer"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(document.querySelector('md-dialog')?.parentElement).toBe(document.body);
  });
});

describe('every dialog goes through Dialog', () => {
  it('no source file uses md-dialog except ui/Dialog.tsx and its type declarations', () => {
    const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(
        ([path, text]) => /<md-dialog|createElement\(['"]md-dialog/.test(text) && !path.endsWith('/ui/Dialog.tsx'),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
