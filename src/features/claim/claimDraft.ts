/** What the claim dialog keeps in the session across the sign-in redirect. */
export interface ClaimDraft {
  /** Empty when the dialog was opened for a server where Moddy creates the invitation. */
  invite: string;
  /** The server the dialog was opened for; null: the free invitation field. */
  guildId: string | null;
}

export const CLAIM_DRAFT_KEY = 'claim-draft';

/** Reads back what `registerBeforeLogin` saved; anything else is no draft. */
export function parseClaimDraft(value: unknown): ClaimDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const invite = typeof raw.invite === 'string' ? raw.invite : '';
  const guildId = typeof raw.guildId === 'string' ? raw.guildId : null;
  // Moddy servers need no invitation: a chosen server alone is a draft. The free field needs its text.
  if (invite.trim() === '' && guildId === null) return null;
  return {invite, guildId};
}
