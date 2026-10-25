/**
 * Every translation, bundled (no HTTP backend). One JSON file per language and
 * namespace, one namespace per feature, so features never edit the same file.
 * English is the source of truth for the types (see i18next.d.ts).
 */

import deBotManage from './locales/de/botManage.json';
import deBots from './locales/de/bots.json';
import deCatalog from './locales/de/catalog.json';
import deClaim from './locales/de/claim.json';
import deCommon from './locales/de/common.json';
import deComponents from './locales/de/components.json';
import deEditor from './locales/de/editor.json';
import deErrors from './locales/de/errors.json';
import deExperiences from './locales/de/experiences.json';
import deFeed from './locales/de/feed.json';
import deGuildManage from './locales/de/guildManage.json';
import deGuildProfile from './locales/de/guildProfile.json';
import deMeProfile from './locales/de/meProfile.json';
import deMyPosts from './locales/de/myPosts.json';
import dePost from './locales/de/post.json';
import deStaff from './locales/de/staff.json';
import deUserProfile from './locales/de/userProfile.json';
import enBotManage from './locales/en/botManage.json';
import enBots from './locales/en/bots.json';
import enCatalog from './locales/en/catalog.json';
import enClaim from './locales/en/claim.json';
import enCommon from './locales/en/common.json';
import enComponents from './locales/en/components.json';
import enEditor from './locales/en/editor.json';
import enErrors from './locales/en/errors.json';
import enExperiences from './locales/en/experiences.json';
import enFeed from './locales/en/feed.json';
import enGuildManage from './locales/en/guildManage.json';
import enGuildProfile from './locales/en/guildProfile.json';
import enMeProfile from './locales/en/meProfile.json';
import enMyPosts from './locales/en/myPosts.json';
import enPost from './locales/en/post.json';
import enStaff from './locales/en/staff.json';
import enUserProfile from './locales/en/userProfile.json';
import esBotManage from './locales/es/botManage.json';
import esBots from './locales/es/bots.json';
import esCatalog from './locales/es/catalog.json';
import esClaim from './locales/es/claim.json';
import esCommon from './locales/es/common.json';
import esComponents from './locales/es/components.json';
import esEditor from './locales/es/editor.json';
import esErrors from './locales/es/errors.json';
import esExperiences from './locales/es/experiences.json';
import esFeed from './locales/es/feed.json';
import esGuildManage from './locales/es/guildManage.json';
import esGuildProfile from './locales/es/guildProfile.json';
import esMeProfile from './locales/es/meProfile.json';
import esMyPosts from './locales/es/myPosts.json';
import esPost from './locales/es/post.json';
import esStaff from './locales/es/staff.json';
import esUserProfile from './locales/es/userProfile.json';
import frBotManage from './locales/fr/botManage.json';
import frBots from './locales/fr/bots.json';
import frCatalog from './locales/fr/catalog.json';
import frClaim from './locales/fr/claim.json';
import frCommon from './locales/fr/common.json';
import frComponents from './locales/fr/components.json';
import frEditor from './locales/fr/editor.json';
import frErrors from './locales/fr/errors.json';
import frExperiences from './locales/fr/experiences.json';
import frFeed from './locales/fr/feed.json';
import frGuildManage from './locales/fr/guildManage.json';
import frGuildProfile from './locales/fr/guildProfile.json';
import frMeProfile from './locales/fr/meProfile.json';
import frMyPosts from './locales/fr/myPosts.json';
import frPost from './locales/fr/post.json';
import frStaff from './locales/fr/staff.json';
import frUserProfile from './locales/fr/userProfile.json';
import ptBRBotManage from './locales/pt-BR/botManage.json';
import ptBRBots from './locales/pt-BR/bots.json';
import ptBRCatalog from './locales/pt-BR/catalog.json';
import ptBRClaim from './locales/pt-BR/claim.json';
import ptBRCommon from './locales/pt-BR/common.json';
import ptBRComponents from './locales/pt-BR/components.json';
import ptBREditor from './locales/pt-BR/editor.json';
import ptBRErrors from './locales/pt-BR/errors.json';
import ptBRExperiences from './locales/pt-BR/experiences.json';
import ptBRFeed from './locales/pt-BR/feed.json';
import ptBRGuildManage from './locales/pt-BR/guildManage.json';
import ptBRGuildProfile from './locales/pt-BR/guildProfile.json';
import ptBRMeProfile from './locales/pt-BR/meProfile.json';
import ptBRMyPosts from './locales/pt-BR/myPosts.json';
import ptBRPost from './locales/pt-BR/post.json';
import ptBRStaff from './locales/pt-BR/staff.json';
import ptBRUserProfile from './locales/pt-BR/userProfile.json';

export const en = {
  common: enCommon,
  components: enComponents,
  errors: enErrors,
  feed: enFeed,
  post: enPost,
  editor: enEditor,
  myPosts: enMyPosts,
  claim: enClaim,
  guildProfile: enGuildProfile,
  guildManage: enGuildManage,
  bots: enBots,
  botManage: enBotManage,
  userProfile: enUserProfile,
  meProfile: enMeProfile,
  experiences: enExperiences,
  staff: enStaff,
  catalog: enCatalog,
};

export type Resources = typeof en;
export type Namespace = keyof Resources;

export const resources = {
  en,
  fr: {
    common: frCommon,
    components: frComponents,
    errors: frErrors,
    feed: frFeed,
    post: frPost,
    editor: frEditor,
    myPosts: frMyPosts,
    claim: frClaim,
    guildProfile: frGuildProfile,
    guildManage: frGuildManage,
    bots: frBots,
    botManage: frBotManage,
    userProfile: frUserProfile,
    meProfile: frMeProfile,
    experiences: frExperiences,
    staff: frStaff,
    catalog: frCatalog,
  },
  es: {
    common: esCommon,
    components: esComponents,
    errors: esErrors,
    feed: esFeed,
    post: esPost,
    editor: esEditor,
    myPosts: esMyPosts,
    claim: esClaim,
    guildProfile: esGuildProfile,
    guildManage: esGuildManage,
    bots: esBots,
    botManage: esBotManage,
    userProfile: esUserProfile,
    meProfile: esMeProfile,
    experiences: esExperiences,
    staff: esStaff,
    catalog: esCatalog,
  },
  'pt-BR': {
    common: ptBRCommon,
    components: ptBRComponents,
    errors: ptBRErrors,
    feed: ptBRFeed,
    post: ptBRPost,
    editor: ptBREditor,
    myPosts: ptBRMyPosts,
    claim: ptBRClaim,
    guildProfile: ptBRGuildProfile,
    guildManage: ptBRGuildManage,
    bots: ptBRBots,
    botManage: ptBRBotManage,
    userProfile: ptBRUserProfile,
    meProfile: ptBRMeProfile,
    experiences: ptBRExperiences,
    staff: ptBRStaff,
    catalog: ptBRCatalog,
  },
  de: {
    common: deCommon,
    components: deComponents,
    errors: deErrors,
    feed: deFeed,
    post: dePost,
    editor: deEditor,
    myPosts: deMyPosts,
    claim: deClaim,
    guildProfile: deGuildProfile,
    guildManage: deGuildManage,
    bots: deBots,
    botManage: deBotManage,
    userProfile: deUserProfile,
    meProfile: deMeProfile,
    experiences: deExperiences,
    staff: deStaff,
    catalog: deCatalog,
  },
};

export const NAMESPACES = Object.keys(en) as Namespace[];
