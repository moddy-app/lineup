/** What the claim dialog keeps in the session across the sign-in redirect. */
export interface ClaimDraft {
  invite: string;
  /** The server the dialog was opened for; null: the free invitation field. */
  guildId: string | null;
}

export const CLAIM_DRAFT_KEY = 'claim-draft';

/** Reads back what `registerBeforeLogin` saved; anything else is no draft. */
export function parseClaimDraft(value: unknown): ClaimDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const {invite, guildId} = value as Record<string, unknown>;
  if (typeof invite !== 'string' || invite.trim() === '') return null;
  return {invite, guildId: typeof guildId === 'string' ? guildId : null};
}
