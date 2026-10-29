// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+).
//
// - traffic: the watched roads, one status row each ("Rocade" /
//   "Dense · 42 km/h"), green when free flowing, orange when heavy, red when
//   congested or closed, grey without a recent measure. The speed or travel
//   time can be hidden (setting `show_details`).
//
// Budget of the core: 8 components, 2 texts, 1 status (10 rows).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { clip } from './devices.js';
import { TEXT, say } from './messages.js';
import { STATUS } from './sources.js';

export const MAX_ROWS = 10;
const MAX_LABEL = 40;

const COLORS = {
  [STATUS.FREE]: WIDGET_COLORS.SUCCESS,
  [STATUS.HEAVY]: WIDGET_COLORS.WARNING,
  [STATUS.CONGESTED]: WIDGET_COLORS.DANGER,
  [STATUS.CLOSED]: WIDGET_COLORS.DANGER,
};

/** The color of a row, from the level of the road. */
export const levelColor = (summary) => COLORS[summary?.level] ?? WIDGET_COLORS.NEUTRAL;

async function trafficContent(service, { settings, language }) {
  await service.firstReading();
  const ttl = Math.max(60, service.config.refreshSeconds);
  const details = settings?.show_details !== false;
  const watched = service.watched();
  const chosen = Array.isArray(settings?.axes) ? settings.axes.map(String) : [];
  const entries =
    chosen.length > 0
      ? chosen.map((id) => watched.find((entry) => entry.deviceId === id)).filter(Boolean)
      : watched;
  if (entries.length === 0) {
    const key = chosen.length > 0 ? 'gone' : 'pickAxis';
    return { ttl_seconds: ttl, components: [{ type: 'text', text: say(TEXT, language, key) }] };
  }
  return {
    ttl_seconds: ttl,
    components: [
      {
        type: 'status',
        items: entries.slice(0, MAX_ROWS).map((entry) => {
          const summary = service.lookup(entry.deviceId)?.summary ?? null;
          return {
            label: clip(entry.name, MAX_LABEL),
            value: clip(service.shortText(summary, language, { details }), 40),
            color: levelColor(summary),
          };
        }),
      },
    ],
  };
}

export const WIDGETS = {
  traffic: { get: trafficContent },
};
