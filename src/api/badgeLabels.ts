/**
 * Local labels of a few badges, over the catalog's. The API labels say who
 * grants the badge ("Vérifié par Lineup", "Partenaire Moddy"); the site shows
 * the plain meaning. Applied by `useCatalogLabel` to the `badges` list, in
 * every language (docs/design.md, "Badges").
 */

import type {Language} from '@/i18n/languages';

export const BADGE_LABEL_OVERRIDES: Readonly<Record<string, Readonly<Record<Language, string>>>> = {
  moddy_partner: {en: 'Partner', fr: 'Partenaire', es: 'Socio', 'pt-BR': 'Parceiro', de: 'Partner'},
  lineup_verified: {en: 'Verified', fr: 'Vérifié', es: 'Verificado', 'pt-BR': 'Verificado', de: 'Verifiziert'},
  moddy_server: {
    en: 'Official Moddy server',
    fr: 'Serveur officiel de Moddy',
    es: 'Servidor oficial de Moddy',
    'pt-BR': 'Servidor oficial do Moddy',
    de: 'Offizieller Moddy-Server',
  },
  moddy_staff: {
    en: 'Moddy team',
    fr: 'Équipe Moddy',
    es: 'Equipo de Moddy',
    'pt-BR': 'Equipe do Moddy',
    de: 'Moddy-Team',
  },
};
