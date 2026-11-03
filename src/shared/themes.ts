import type { ThemeId } from './types';

export type ThemeGroupId = 'base' | 'season' | 'style' | 'holiday';

/** Светлая тема: базовые токены игры переопределяются на тёмный текст и светлые панели. */
export type ThemeScheme = 'dark' | 'light';

export interface ThemeGroup {
  id: ThemeGroupId;
  label: string;
}

export interface PackTheme {
  id: ThemeId;
  label: string;
  description: string;
  group: ThemeGroupId;
  scheme: ThemeScheme;
  /** Три цвета для превью в редакторе: фон, акцент, акцент-2 */
  swatch: [string, string, string];
}

export const DEFAULT_THEME: ThemeId = 'default';

/** Порядок групп в редакторе паков. */
export const THEME_GROUPS: ThemeGroup[] = [
  { id: 'base', label: 'Базовые' },
  { id: 'season', label: 'Сезоны' },
  { id: 'style', label: 'Стили' },
  { id: 'holiday', label: 'Праздники' }
];

/**
 * Темы оформления игрового экрана. Применяются только к паку во время игры:
 * редактор паков и панель ведущего всегда остаются в своей тёмной теме.
 */
export const PACK_THEMES: PackTheme[] = [
  {
    id: 'default',
    label: 'Студия',
    description: 'Тёмная сцена с фиолетовыми и бирюзовыми акцентами — базовый вид QuizMaster',
    group: 'base',
    scheme: 'dark',
    swatch: ['#0b0f1f', '#7c6cf5', '#22d3ee']
  },
  {
    id: 'blue',
    label: 'Голубая',
    description: 'Океанский синий и прохладная бирюза, как в телевикторине',
    group: 'base',
    scheme: 'dark',
    swatch: ['#04121f', '#38bdf8', '#a5f3fc']
  },
  {
    id: 'pink',
    label: 'Розовая',
    description: 'Мягкий розовый закат с пудровыми акцентами',
    group: 'base',
    scheme: 'dark',
    swatch: ['#1a0a16', '#f472b6', '#fbcfe8']
  },
  {
    id: 'pastel',
    label: 'Пастель',
    description: 'Светлая пастель: крем, лаванда, мята и персик — мягко и празднично',
    group: 'base',
    scheme: 'light',
    swatch: ['#fdf6fb', '#c4b5fd', '#f9a8d4']
  },
  {
    id: 'winter',
    label: 'Зима',
    description: 'Морозная ночь, лёд и медленный снегопад',
    group: 'season',
    scheme: 'dark',
    swatch: ['#071424', '#7dd3fc', '#e2e8f0']
  },
  {
    id: 'spring',
    label: 'Весна',
    description: 'Свежая зелень и лепестки цветущих яблонь',
    group: 'season',
    scheme: 'dark',
    swatch: ['#0c1a12', '#86efac', '#f9a8d4']
  },
  {
    id: 'summer',
    label: 'Лето',
    description: 'Солнце, кораллы и тёплое море',
    group: 'season',
    scheme: 'dark',
    swatch: ['#1b1206', '#fbbf24', '#2dd4bf']
  },
  {
    id: 'autumn',
    label: 'Осень',
    description: 'Кленовые листья, золото и тёплый янтарный свет',
    group: 'season',
    scheme: 'dark',
    swatch: ['#1a0e05', '#fb923c', '#fbbf24']
  },
  {
    id: 'cyberpunk',
    label: 'Киберпанк',
    description: 'Неон, электрический фиолетовый и кислотный лайм',
    group: 'style',
    scheme: 'dark',
    swatch: ['#05010f', '#d946ef', '#a3e635']
  },
  {
    id: 'retro',
    label: 'Ретро (XP)',
    description: 'Windows XP: синее небо, зелёные холмы, серебристые панели и кнопка «Пуск»',
    group: 'style',
    scheme: 'light',
    swatch: ['#4c8fdd', '#2f6fd0', '#3f9c35']
  },
  {
    id: 'win98',
    label: 'Windows 98',
    description: 'Классика 98-го: бирюзовый рабочий стол, серое окно с объёмными кнопками и синий заголовок',
    group: 'style',
    scheme: 'light',
    swatch: ['#008080', '#000080', '#c0c0c0']
  },
  {
    id: 'halloween',
    label: 'Хэллоуин',
    description: 'Чёрный, оранжевый и зелёный: крупные размытые тыквы и чёткие летучие мыши в углах',
    group: 'holiday',
    scheme: 'dark',
    swatch: ['#0a0805', '#f97316', '#22c55e']
  },
  {
    id: 'newyear',
    label: 'Новый год',
    description: 'Зелёный, красный и белый: снег, большие ёлки на фоне и венки с бантами',
    group: 'holiday',
    scheme: 'dark',
    swatch: ['#071a12', '#ef4444', '#4ade80']
  },
  {
    id: 'valentine',
    label: 'День святого Валентина',
    description: 'Розовые сердца и тёплый рубиновый свет',
    group: 'holiday',
    scheme: 'dark',
    swatch: ['#1a0711', '#fb7185', '#fda4af']
  }
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && PACK_THEMES.some((theme) => theme.id === value);
}

export function normalizeTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}

export function themeLabel(id: ThemeId): string {
  return PACK_THEMES.find((theme) => theme.id === id)?.label ?? 'Студия';
}

export function themeScheme(id: ThemeId): ThemeScheme {
  return PACK_THEMES.find((theme) => theme.id === id)?.scheme ?? 'dark';
}

export function themesOfGroup(group: ThemeGroupId): PackTheme[] {
  return PACK_THEMES.filter((theme) => theme.group === group);
}
