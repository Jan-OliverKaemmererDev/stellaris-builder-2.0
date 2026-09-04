/**
 * Central definitions for all game resources in Stellaris Builder.
 * Serves as the single source of truth for names, icons, and theme colors.
 */

export type ResourceKey =
  | 'eisen'
  | 'silber'
  | 'gold'
  | 'xenonit'
  | 'credits'
  | 'energie'
  | 'nahrung'
  | 'personal';

export interface ResourceDefinition {
  id: ResourceKey;
  name: string;
  iconKey: string;
  iconClass: string;
  colorVar: string;
  cssVar: string;
  colorHex: string;
}

export const RESOURCE_DEFINITIONS: Record<ResourceKey, ResourceDefinition> = {
  eisen: {
    id: 'eisen',
    name: 'Eisen',
    iconKey: 'iron',
    iconClass: 'css-icon-iron',
    colorVar: 'var(--color-eisen)',
    cssVar: '--color-eisen',
    colorHex: '#cbd5e1',
  },
  silber: {
    id: 'silber',
    name: 'Silber',
    iconKey: 'silver',
    iconClass: 'css-icon-silver',
    colorVar: 'var(--color-silber)',
    cssVar: '--color-silber',
    colorHex: '#e2e8f0',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    iconKey: 'gold',
    iconClass: 'css-icon-gold',
    colorVar: 'var(--color-gold)',
    cssVar: '--color-gold',
    colorHex: '#fbbf24',
  },
  xenonit: {
    id: 'xenonit',
    name: 'Xenonit',
    iconKey: 'xenonit',
    iconClass: 'css-icon-xenonit',
    colorVar: 'var(--color-xenonit)',
    cssVar: '--color-xenonit',
    colorHex: '#10b981',
  },
  credits: {
    id: 'credits',
    name: 'Credits',
    iconKey: 'credits',
    iconClass: 'css-icon-credits',
    colorVar: 'var(--color-credits)',
    cssVar: '--color-credits',
    colorHex: '#3b82f6',
  },
  energie: {
    id: 'energie',
    name: 'Energie',
    iconKey: 'energy',
    iconClass: 'css-icon-energy',
    colorVar: 'var(--color-energie)',
    cssVar: '--color-energie',
    colorHex: '#facc15',
  },
  nahrung: {
    id: 'nahrung',
    name: 'Nahrung',
    iconKey: 'food',
    iconClass: 'css-icon-food',
    colorVar: 'var(--color-nahrung)',
    cssVar: '--color-nahrung',
    colorHex: '#34d399',
  },
  personal: {
    id: 'personal',
    name: 'Personal',
    iconKey: 'staff',
    iconClass: 'css-icon-staff',
    colorVar: 'var(--color-personal)',
    cssVar: '--color-personal',
    colorHex: '#f472b6',
  },
};

export const RESOURCE_LIST: ResourceDefinition[] = Object.values(RESOURCE_DEFINITIONS);

/**
 * Resolves a resource key or alias into its corresponding CSS icon class.
 * Supports German names ('eisen'), English names ('iron'), and full classes ('css-icon-iron').
 */
export function getResourceIconClass(key: string): string {
  if (!key) return '';
  if (key.startsWith('css-icon-')) return key;

  const normalized = key.toLowerCase().trim();
  const def = RESOURCE_DEFINITIONS[normalized as ResourceKey];
  if (def) return def.iconClass;

  // Fallback direct map for aliases
  const aliasMap: Record<string, string> = {
    iron: 'css-icon-iron',
    silver: 'css-icon-silver',
    gold: 'css-icon-gold',
    xenonit: 'css-icon-xenonit',
    credits: 'css-icon-credits',
    energy: 'css-icon-energy',
    energie: 'css-icon-energy',
    food: 'css-icon-food',
    nahrung: 'css-icon-food',
    staff: 'css-icon-staff',
    personal: 'css-icon-staff',
    nanobots: 'css-icon-nanobots',
    rules: 'css-icon-rules',
    spielregeln: 'css-icon-rules',
    privacy: 'css-icon-privacy',
    datenschutz: 'css-icon-privacy',
    legal: 'css-icon-legal',
    impressum: 'css-icon-legal',
    logout: 'css-icon-logout',
    diplomacy: 'css-icon-diplomacy',
    handshake: 'css-icon-diplomacy',
    peace: 'css-icon-peace',
    peaceful: 'css-icon-peaceful',
    shield: 'css-icon-peaceful',
    alien: 'css-icon-alien',
    warlord: 'css-icon-warlord',
    warning: 'css-icon-warning',
    alert: 'css-icon-warning',
    speaker: 'css-icon-speaker',
    'speaker-muted': 'css-icon-speaker-muted',
    sound: 'css-icon-speaker',
    sounds: 'css-icon-speaker',
    'sound-off': 'css-icon-speaker-muted',
    'sound-muted': 'css-icon-speaker-muted',
    audio: 'css-icon-speaker',
    music: 'css-icon-music',
    play: 'css-icon-play',
    pause: 'css-icon-pause',
    'skip-next': 'css-icon-skip-next',
    'skip-prev': 'css-icon-skip-prev',
  };

  if (aliasMap[normalized]) {
    return aliasMap[normalized];
  }

  // If it matches title-* or ship-*
  if (normalized.startsWith('title-') || normalized.startsWith('ship-')) {
    return `css-icon-${normalized}`;
  }

  return `css-icon-${normalized}`;
}
