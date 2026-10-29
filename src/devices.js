// -----------------------------------------------------------------------------
// The Gladys device of a followed road ("axis": every segment of one road, or
// the segments around the house) and its states:
//   status       text/text                         "Fluide", "Dense"…
//   level        risk/integer 0..4                 0 unknown, 1 free flow,
//                                                  2 heavy, 3 congested, 4 closed
//   speed        speed-sensor/integer (km/h)       average speed (Rennes,
//                                                  Nantes, Strasbourg)
//   travel_time  duration/decimal (minutes)        travel time (Bordeaux)
//   usual_time   duration/decimal (minutes)        its usual value (Bordeaux)
//   age          duration/integer (minutes)        age of the measure
//
// Read-only, no polling: the integration reads the portals on its own timer
// (src/service.js), Gladys never polls (`should_poll: false`).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { NAMES, levelName } from './messages.js';
import { STATUS } from './sources.js';

export const AXIS_TYPE = 'axis';
export const HOME_AXIS = 'home';
export const MAX_DEVICE_NAME = 80;
export const MAX_AGE_MINUTES = 1440;
// A measure older than this is no measure: the road is "unknown", nothing is
// made up from it.
export const STALE_MS = 30 * 60 * 1000;
// The level of a road is the worst one met on a quarter of its length at least.
export const LEVEL_SHARE = 0.25;

/** Shortens a text to `max` characters, with an ellipsis. */
export function clip(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** The platform id of an axis: "<source key>-<axis key>". */
export const axisPlatformId = (sourceKey, axisKey) => `${sourceKey}-${axisKey}`;

/** The feature keys of an axis of this source. */
export const featureKeys = (source) => [
  'status',
  'level',
  ...(source.hasSpeed ? ['speed'] : []),
  ...(source.hasTravelTime ? ['travel_time', 'usual_time'] : []),
  'age',
];

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * The state of an axis from the measures of its segments: the level, the
 * average speed, the travel time and the date of the newest measure. Only
 * measures less than STALE_MS old count; without any, the level is unknown
 * and nothing else is given (the age still says how old the data is).
 * @param {Array<object|undefined>} measures
 * @param {number} now
 */
export function aggregate(measures, now) {
  const all = measures.filter(Boolean);
  const newest = (list) =>
    list.reduce((max, m) => (m.at !== null && (max === null || m.at > max) ? m.at : max), null);
  const fresh = all.filter((m) => m.at !== null && now - m.at <= STALE_MS);
  const known = fresh.filter((m) => m.status > STATUS.UNKNOWN);
  if (known.length === 0) {
    return { level: STATUS.UNKNOWN, speed: null, time: null, usual: null, at: newest(all) };
  }
  const byLength = known.every((m) => m.length !== null);
  const weight = (m) => (byLength ? m.length : 1);
  const total = known.reduce((sum, m) => sum + weight(m), 0);
  let level = STATUS.FREE;
  for (const candidate of [STATUS.CLOSED, STATUS.CONGESTED, STATUS.HEAVY]) {
    const share = known.filter((m) => m.status >= candidate).reduce((s, m) => s + weight(m), 0);
    if (total > 0 && share / total >= LEVEL_SHARE) {
      level = candidate;
      break;
    }
  }
  const moving = known.filter((m) => m.speed !== null);
  let speed = null;
  if (moving.length > 0) {
    const timed = moving.every((m) => m.length !== null && m.time !== null);
    speed = timed
      ? (moving.reduce((s, m) => s + m.length, 0) / moving.reduce((s, m) => s + m.time, 0)) * 3.6
      : moving.reduce((s, m) => s + m.speed, 0) / moving.length;
    speed = Math.round(speed);
  }
  const sum = (key) =>
    known.every((m) => m[key] !== null) ? known.reduce((s, m) => s + m[key], 0) : null;
  return { level, speed, time: sum('time'), usual: sum('usual'), at: newest(known) };
}

/**
 * The device of an axis.
 * @param {object} gladys
 * @param {string} sourceKey
 * @param {object} source an entry of SOURCES
 * @param {{ key: string, name: string }} axis
 * @param {string} language
 */
export function buildAxisDevice(gladys, sourceKey, source, axis, language) {
  const ids = gladys.externalIds(AXIS_TYPE, axisPlatformId(sourceKey, axis.key));
  const names = NAMES[language] ?? NAMES.en;
  const axisName = axis.key === HOME_AXIS ? names.home : axis.name;
  const definitions = {
    status: { category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0 },
    level: { category: C.RISK, type: T.RISK.INTEGER, min: 0, max: 4 },
    speed: {
      category: C.SPEED_SENSOR,
      type: T.SPEED_SENSOR.INTEGER,
      unit: U.KILOMETER_PER_HOUR,
      min: 0,
      max: 130,
    },
    travel_time: {
      category: C.DURATION,
      type: T.DURATION.DECIMAL,
      unit: U.MINUTES,
      min: 0,
      max: 120,
    },
    usual_time: {
      category: C.DURATION,
      type: T.DURATION.DECIMAL,
      unit: U.MINUTES,
      min: 0,
      max: 120,
    },
    age: {
      category: C.DURATION,
      type: T.DURATION.INTEGER,
      unit: U.MINUTES,
      min: 0,
      max: MAX_AGE_MINUTES,
    },
  };
  return {
    name: clip(`${source.name} · ${axisName}`, MAX_DEVICE_NAME),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'source', value: sourceKey },
      { name: 'axis', value: axis.key },
    ],
    features: featureKeys(source).map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...definitions[key],
      read_only: true,
      has_feedback: false,
    })),
  };
}

/**
 * The states of an axis device. A value the measures do not give is not
 * published: the last known one stays, the level says "unknown".
 * @param {object} summary from aggregate()
 */
export function axisStates(gladys, sourceKey, source, axisKey, summary, now, language) {
  const ids = gladys.externalIds(AXIS_TYPE, axisPlatformId(sourceKey, axisKey));
  const values = {
    status: levelName(summary.level, language),
    level: summary.level,
    speed: summary.speed,
    travel_time: summary.time === null ? null : round1(summary.time / 60),
    usual_time: summary.usual === null ? null : round1(summary.usual / 60),
    age:
      summary.at === null
        ? null
        : Math.min(MAX_AGE_MINUTES, Math.max(0, Math.floor((now - summary.at) / 60000))),
  };
  return featureKeys(source)
    .filter((key) => values[key] !== null && values[key] !== undefined)
    .map((key) =>
      key === 'status'
        ? { device_feature_external_id: ids.feature(key), text: values[key] }
        : { device_feature_external_id: ids.feature(key), state: values[key] },
    );
}
