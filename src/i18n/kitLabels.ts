/**
 * The texts of the design kit's components (app bar, user menu, theme menu),
 * in the five languages. They come from the kit, not from our namespaces.
 */

import de from '@moddy/design-kit/labels/de.json';
import en from '@moddy/design-kit/labels/en.json';
import es from '@moddy/design-kit/labels/es.json';
import fr from '@moddy/design-kit/labels/fr.json';
import ptBR from '@moddy/design-kit/labels/pt-BR.json';

import type {Language} from './languages';

const KIT_LABELS = {en, fr, es, 'pt-BR': ptBR, de} satisfies Record<Language, typeof en>;

export function kitLabels(language: Language) {
  return KIT_LABELS[language];
}
