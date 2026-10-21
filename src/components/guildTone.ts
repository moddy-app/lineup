import type {ShapeTone} from '@/ui';

const TONES: readonly ShapeTone[] = ['primary', 'secondary', 'tertiary'];

/** A server without an icon keeps the same color everywhere: the tone comes from its id. */
export function guildTone(id: string): ShapeTone {
  try {
    return TONES[Number(BigInt(id) % 3n)] ?? 'primary';
  } catch {
    return 'primary';
  }
}
