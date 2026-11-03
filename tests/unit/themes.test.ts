import {
  DEFAULT_THEME,
  PACK_THEMES,
  THEME_GROUPS,
  isThemeId,
  normalizeTheme,
  themeLabel,
  themeScheme,
  themesOfGroup
} from '../../src/shared/themes';
import { createEmptyPack, normalizePack } from '../../src/shared/factory';
import type { ThemeId } from '../../src/shared/types';
import { test, eq } from './harness';

const EXPECTED_IDS: ThemeId[] = [
  'default',
  'blue',
  'pink',
  'pastel',
  'winter',
  'spring',
  'summer',
  'autumn',
  'cyberpunk',
  'retro',
  'win98',
  'halloween',
  'newyear',
  'valentine'
];

test('Каталог тем: все 14 тем на месте и без повторов', () => {
  eq(PACK_THEMES.map((theme) => theme.id), EXPECTED_IDS);
  eq(new Set(PACK_THEMES.map((theme) => theme.id)).size, EXPECTED_IDS.length);
  eq(PACK_THEMES.length, 14);
});

test('Каталог тем: у каждой темы есть подпись, описание, группа и три цвета', () => {
  for (const theme of PACK_THEMES) {
    if (!theme.label.trim()) throw new Error(`Пустая подпись у темы ${theme.id}`);
    if (!theme.description.trim()) throw new Error(`Пустое описание у темы ${theme.id}`);
    if (theme.swatch.length !== 3) throw new Error(`Не три цвета в swatch у темы ${theme.id}`);
    for (const color of theme.swatch) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Некорректный цвет ${color} у темы ${theme.id}`);
    }
    if (!THEME_GROUPS.some((group) => group.id === theme.group)) {
      throw new Error(`Неизвестная группа ${theme.group} у темы ${theme.id}`);
    }
  }
  eq(new Set(PACK_THEMES.map((theme) => theme.label)).size, PACK_THEMES.length);
});

test('Каталог тем: группы покрывают все темы, сезоны и праздники на месте', () => {
  const grouped = THEME_GROUPS.flatMap((group) => themesOfGroup(group.id));
  eq(grouped.length, PACK_THEMES.length);
  eq(
    themesOfGroup('base').map((theme) => theme.id),
    ['default', 'blue', 'pink', 'pastel']
  );
  eq(
    themesOfGroup('season').map((theme) => theme.id),
    ['winter', 'spring', 'summer', 'autumn']
  );
  eq(
    themesOfGroup('style').map((theme) => theme.id),
    ['cyberpunk', 'retro', 'win98']
  );
  eq(
    themesOfGroup('holiday').map((theme) => theme.id),
    ['halloween', 'newyear', 'valentine']
  );
});

test('Светлые темы помечены scheme=light, остальные тёмные', () => {
  const light = PACK_THEMES.filter((theme) => theme.scheme === 'light').map((theme) => theme.id);
  eq(light, ['pastel', 'retro', 'win98']);
  eq(themeScheme('pastel'), 'light');
  eq(themeScheme('win98'), 'light');
  eq(themeScheme('default'), 'dark');
  eq(themeScheme('halloween'), 'dark');
});

test('isThemeId принимает только известные идентификаторы', () => {
  for (const id of EXPECTED_IDS) eq(isThemeId(id), true, id);
  eq(isThemeId('unknown'), false);
  eq(isThemeId(''), false);
  eq(isThemeId(null), false);
  eq(isThemeId(42), false);
});

test('normalizeTheme: старые паки без темы получают «Студию»', () => {
  eq(DEFAULT_THEME, 'default');
  eq(normalizeTheme(undefined), 'default');
  eq(normalizeTheme(null), 'default');
  eq(normalizeTheme('nosuchtheme'), 'default');
  eq(normalizeTheme('valentine'), 'valentine');
  eq(normalizeTheme('winter'), 'winter');
});

test('themeLabel возвращает подпись темы', () => {
  eq(themeLabel('retro'), 'Ретро (XP)');
  eq(themeLabel('win98'), 'Windows 98');
  eq(themeLabel('pastel'), 'Пастель');
  eq(themeLabel('valentine'), 'День святого Валентина');
  eq(themeLabel('default'), 'Студия');
});

test('Новый пак создаётся с темой «Студия»', () => {
  const pack = createEmptyPack();
  eq(pack.theme, 'default');
});

test('normalizePack сохраняет тему и восстанавливает старые паки', () => {
  const withTheme = normalizePack({
    title: 'Зимний квиз',
    theme: 'winter',
    settings: { defaultTimeLimitSec: 30, defaultPoints: 2, partialCreditRatio: 0.5 },
    rounds: []
  });
  eq(withTheme.theme, 'winter');

  const oldPack = normalizePack({
    title: 'Старый пак',
    settings: { defaultTimeLimitSec: 60, defaultPoints: 1, partialCreditRatio: 0.5 },
    rounds: []
  });
  eq(oldPack.theme, 'default');

  const broken = normalizePack({
    title: 'Битый пак',
    theme: 'rainbow',
    settings: { defaultTimeLimitSec: 60, defaultPoints: 1, partialCreditRatio: 0.5 },
    rounds: []
  });
  eq(broken.theme, 'default');
});
