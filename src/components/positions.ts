/** Positions of a post or an experience: their icon, and the labels to show. */

export const FALLBACK_POSITION_ICON = 'work';

const POSITION_ICONS: Readonly<Record<string, string>> = {
  moderator: 'shield_person',
  admin: 'admin_panel_settings',
  community_manager: 'forum',
  manager: 'supervisor_account',
  communication: 'campaign',
  developer: 'code',
  graphic_designer: 'palette',
  support: 'support_agent',
  event_animator: 'celebration',
  partnership_manager: 'handshake',
  other: 'work',
};

export function positionIcon(id: string): string {
  return POSITION_ICONS[id] ?? FALLBACK_POSITION_ICON;
}

export interface PositionItem {
  key: string;
  label: string;
  icon: string;
}

/**
 * What to show for a list of position ids. `other` shows the free labels the
 * author wrote (`positions_other`) in its place; with none, the catalog's own
 * "Other".
 */
export function positionItems(
  positions: readonly string[],
  positionsOther: readonly string[],
  label: (id: string) => string,
): PositionItem[] {
  return positions.flatMap((id): PositionItem[] => {
    if (id === 'other' && positionsOther.length > 0) {
      return positionsOther.map((text, index) => ({key: `other:${index}`, label: text, icon: positionIcon('other')}));
    }
    return [{key: id, label: label(id), icon: positionIcon(id)}];
  });
}
