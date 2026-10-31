// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

import { SOURCE_KEYS } from './sources.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Seconds between two readings: two to five minutes, the pace of the portals.
// The integration drives its own timer (devices are published with
// should_poll: false, the core only polls up to one minute).
export const REFRESH_INTERVALS = ['120', '180', '300'];

// Radius of the "around the house" device, in metres; "0" = no such device.
export const HOME_RADII = ['0', '500', '1000', '2000', '3000'];

export const DEFAULT_CONFIG = {
  cities: [],
  roads: '',
  home_radius: '1000',
  language: 'fr',
  refresh_interval: '180',
  // The Grand Lyon data account, only for Lyon (no default in the manifest:
  // the password is a `secret`).
  grandlyon_username: '',
  grandlyon_password: '',
};

// A search term shorter than this would match half the roads of a city.
export const MIN_TERM = 3;

/** Lower case, without accents: what the road search compares. */
export const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** The cities chosen: an array from the form, tolerating a JSON or comma-separated string. */
function citiesOf(value) {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      list = value.split(',');
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const wanted = list.map((item) => String(item).trim());
  return SOURCE_KEYS.filter((key) => wanted.includes(key));
}

/** "Rocade, Lorient; patton" → ["rocade", "lorient", "patton"]. */
export function termsOf(value) {
  const terms = String(value ?? '')
    .split(/[,;\n]/)
    .map(fold)
    .filter((term) => term.length >= MIN_TERM);
  return [...new Set(terms)];
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const pick = (key, allowed) =>
    allowed.includes(String(source[key])) ? String(source[key]) : DEFAULT_CONFIG[key];
  return {
    cities: citiesOf(source.cities),
    terms: termsOf(source.roads),
    homeRadius: Number(pick('home_radius', HOME_RADII)),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
    refreshSeconds: Number(pick('refresh_interval', REFRESH_INTERVALS)),
    // Both or nothing. The password is kept as typed: spaces may be part of it.
    grandLyon:
      typeof source.grandlyon_username === 'string' &&
      source.grandlyon_username.trim() &&
      typeof source.grandlyon_password === 'string' &&
      source.grandlyon_password
        ? { user: source.grandlyon_username.trim(), password: source.grandlyon_password }
        : null,
  };
}
