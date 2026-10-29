// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// - traffic_summary: the state of the watched roads (all of them, or the ones
//   picked) in one sentence ready for a message or a speaker ("Trafic :
//   Rocade (dense, 42 km/h). Fluide ailleurs."), with the worst level and the
//   number of roads heavy or worse, for a "Continue only if" step.
//
// A scene action does not receive the user's language: the sentence follows
// the `language` of the configuration. Outputs are numbers, never booleans:
// the core's "Continue only if" compares with ===. A road without a recent
// measure is left out of the sentence.
// -----------------------------------------------------------------------------

import { LEVELS, TEXT, say } from './messages.js';
import { STATUS } from './sources.js';

export class SceneError extends Error {}

const MAX_SENTENCE = 500;

const chosenIds = (value) =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

const PREFIX = { en: 'Traffic', fr: 'Trafic', de: 'Verkehr', es: 'Tráfico' };

export const SCENE_ACTIONS = {
  async traffic_summary(service, { fields }) {
    const language = service.config.language;
    // Asked right at start: the first reading, not "no measure".
    await service.firstReading();
    const watched = service.watched().map((entry) => entry.deviceId);
    if (watched.length === 0) {
      throw new SceneError(say(TEXT, language, 'noAxis'));
    }
    const asked = chosenIds(fields?.axes);
    const chosen = asked.filter((id) => watched.includes(id));
    if (asked.length > 0 && chosen.length === 0) {
      throw new SceneError(say(TEXT, language, 'gone'));
    }
    const roads = (chosen.length > 0 ? chosen : watched)
      .map((id) => service.lookup(id))
      .filter((found) => found?.summary && found.summary.level !== STATUS.UNKNOWN);
    const worst = roads.reduce((max, found) => Math.max(max, found.summary.level), 0);
    const jammed = roads.filter((found) => found.summary.level >= STATUS.HEAVY);
    let sentence;
    if (roads.length === 0) {
      sentence = say(TEXT, language, 'noData');
    } else if (jammed.length === 0) {
      sentence = say(TEXT, language, 'allFree', { count: roads.length });
    } else {
      const parts = jammed
        .sort((a, b) => b.summary.level - a.summary.level)
        .map((found) => {
          const detail = service.shortText(found.summary, language).split(' · ')[1];
          const word = (LEVELS[language] ?? LEVELS.en)[found.summary.level];
          return `${found.entry.name} (${word}${detail ? `, ${detail}` : ''})`;
        });
      const rest = jammed.length < roads.length ? ` ${say(TEXT, language, 'elsewhere')}` : '';
      const colon = language === 'fr' ? ' : ' : ': ';
      sentence = `${PREFIX[language] ?? PREFIX.en}${colon}${parts.join(', ')}.${rest}`;
    }
    return {
      sentence:
        sentence.length <= MAX_SENTENCE ? sentence : `${sentence.slice(0, MAX_SENTENCE - 1)}…`,
      worst_level: worst,
      jammed: jammed.length,
    };
  },
};
