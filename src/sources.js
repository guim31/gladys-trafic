// -----------------------------------------------------------------------------
// The open data sources: one adapter per metropolis, each turning its own
// fields into the same two shapes.
//
// The catalog of the road segments (read once a day):
//
//   { id, axisKey, axisName, lat, lon }
//
//   axisKey    the road the segment belongs to, part of the device external id
//   axisName   its name, as shown in the Discover tab
//
// The live measure of a segment (read at every cycle, filtered on the ids of
// the segments followed, never the whole dataset):
//
//   { status, speed, time, usual, length, at }
//
//   status     0 unknown, 1 free flow, 2 heavy, 3 congested, 4 closed
//   speed      average speed in km/h, or null
//   time       travel time in seconds, or null
//   usual      usual travel time in seconds (Bordeaux), or null
//   length     length in metres (weight of the segment), or null
//   at         date of the measure in ms, or null
//
// Every source below was checked live on 2026-10-29 (test/fixtures/sources
// holds those answers). Keys are part of the device external ids: never
// rename one.
// -----------------------------------------------------------------------------

import { getJson } from './http.js';

export const STATUS = { UNKNOWN: 0, FREE: 1, HEAVY: 2, CONGESTED: 3, CLOSED: 4 };

const CATALOG_MAX_BYTES = 4e6;
const LIVE_MAX_BYTES = 2e6;
// Ids per live request: keeps the URL far below the 8 KB servers accept.
export const IDS_PER_REQUEST = 100;

/** A finite number, or null. */
export function num(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** A positive number, or null (a speed or a time of 0 means "no measure"). */
const positive = (value) => {
  const number = num(value);
  return number !== null && number > 0 ? number : null;
};

/** A date in ms, or null. */
export function time(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Letters, digits and "-" only, lower case: a piece of an external id. */
export const slug = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** An ODSQL literal: a number, or a quoted string. */
const literal = (value) =>
  typeof value === 'number' ? String(value) : `"${String(value).replace(/["\\]/g, '\\$&')}"`;

/** The URL of an Opendatasoft Explore v2.1 export (every record, one request). */
export function exportUrl(base, dataset, query) {
  return `${base}/api/explore/v2.1/catalog/datasets/${dataset}/exports/json?${new URLSearchParams(query)}`;
}

/** Every record of an export, as an array. */
async function exportRecords(fetch, base, dataset, query, maxBytes) {
  const data = await getJson(fetch, exportUrl(base, dataset, query), { maxBytes });
  return Array.isArray(data) ? data : [];
}

/** The live records of some segments, `IDS_PER_REQUEST` ids per request. */
async function liveRecords(fetch, base, dataset, idField, select, ids) {
  const records = [];
  for (let start = 0; start < ids.length; start += IDS_PER_REQUEST) {
    const chunk = ids.slice(start, start + IDS_PER_REQUEST);
    records.push(
      ...(await exportRecords(
        fetch,
        base,
        dataset,
        { select, where: `${idField} in (${chunk.map(literal).join(',')})` },
        LIVE_MAX_BYTES,
      )),
    );
  }
  return records;
}

const point = (geo) => ({ lat: num(geo?.lat), lon: num(geo?.lon) });

// The communes of Rennes Métropole (geo.api.gouv.fr, EPCI 243500139): a
// street name is only unique within its commune.
const RENNES_COMMUNES = {
  35001: 'Acigné',
  35022: 'Bécherel',
  35024: 'Betton',
  35032: 'Bourgbarré',
  35039: 'Brécé',
  35047: 'Bruz',
  35051: 'Cesson-Sévigné',
  35055: 'Chantepie',
  35058: 'La Chapelle-Chaussée',
  35059: 'La Chapelle-des-Fougeretz',
  35065: 'La Chapelle-Thouarault',
  35066: 'Chartres-de-Bretagne',
  35076: 'Chavagne',
  35079: 'Chevaigné',
  35080: 'Cintré',
  35081: 'Clayes',
  35088: 'Corps-Nuds',
  35120: 'Gévezé',
  35131: "L'Hermitage",
  35139: 'Laillé',
  35144: 'Langan',
  35180: 'Miniac-sous-Bécherel',
  35189: 'Montgermont',
  35196: 'Mordelles',
  35204: 'Nouvoitou',
  35206: 'Noyal-Châtillon-sur-Seiche',
  35208: 'Orgères',
  35210: 'Pacé',
  35216: 'Parthenay-de-Bretagne',
  35238: 'Rennes',
  35240: 'Le Rheu',
  35245: 'Romillé',
  35250: 'Saint-Armel',
  35266: 'Saint-Erblon',
  35275: 'Saint-Gilles',
  35278: 'Saint-Grégoire',
  35281: 'Saint-Jacques-de-la-Lande',
  35315: 'Saint-Sulpice-la-Forêt',
  35334: 'Thorigné-Fouillard',
  35351: 'Le Verger',
  35352: 'Vern-sur-Seiche',
  35353: 'Vezin-le-Coquet',
  35363: 'Pont-Péan',
};

/**
 * The road of a Rennes segment. National and departmental roads cross
 * communes: one axis each. A street is one axis per commune. The generic
 * names ("Rond-point", unnamed ways) are no road anyone follows.
 */
export function rennesAxis(denomination, insee) {
  const name = String(denomination ?? '').trim();
  if (!name || /^rond-point$/i.test(name) || /^inconnu/i.test(name)) {
    return null;
  }
  if (/^(route (nationale|départementale)|rocade|autoroute)\b/i.test(name)) {
    return { axisKey: slug(name), axisName: name };
  }
  const commune = RENNES_COMMUNES[insee];
  return {
    axisKey: `${slug(name)}-${num(insee) ?? 0}`,
    axisName: commune ? `${name} (${commune})` : name,
  };
}

const RENNES_STATUS = {
  freeFlow: STATUS.FREE,
  heavy: STATUS.HEAVY,
  congested: STATUS.CONGESTED,
  impossible: STATUS.CLOSED,
};

/** "Anglais" from "Anglais I5": the trailing code is the direction and the rank. */
export const nantesAxis = (label) =>
  String(label ?? '')
    .trim()
    .replace(/\s+[IP]\d*$/, '');

// etat_trafic of Nantes: "Bloqué" is a standstill, not a closed road;
// "Indéterminé" and anything else, unknown.
const NANTES_STATUS = {
  fluide: STATUS.FREE,
  dense: STATUS.HEAVY,
  sature: STATUS.CONGESTED,
  bloque: STATUS.CONGESTED,
};

/** "Schirmeck - Sortie Ville" from "Schirmeck12 - Sortie Ville": one axis for the numbered sensors. */
export const strasbourgAxis = (name) =>
  String(name ?? '')
    .trim()
    .replace(/^(\D*?\p{L})\d+(?=\s*-)/u, '$1');

/**
 * Bordeaux publishes travel times and their usual value, no status: the
 * status is the ratio of the two (up to 1.3 free flow, up to 1.8 heavy,
 * above congested). These thresholds are the integration's, said in the docs.
 */
export function bordeauxStatus(actual, usual) {
  if (actual === null || usual === null) {
    return STATUS.UNKNOWN;
  }
  const ratio = actual / usual;
  if (ratio <= 1.3) {
    return STATUS.FREE;
  }
  return ratio <= 1.8 ? STATUS.HEAVY : STATUS.CONGESTED;
}

export const SOURCES = {
  // data.rennesmetropole.fr, "État du trafic en temps réel" (floating car
  // data), about 2,900 segments, updated every few minutes.
  rennes: {
    name: 'Rennes Métropole',
    publisher: 'Rennes Métropole',
    dataset:
      'https://data.rennesmetropole.fr/explore/dataset/etat-du-trafic-en-temps-reel/information/',
    hasSpeed: true,
    hasTravelTime: false,
    listAll: false,
    async catalog(fetch) {
      const records = await exportRecords(
        fetch,
        'https://data.rennesmetropole.fr',
        'etat-du-trafic-en-temps-reel',
        { select: 'predefinedlocationreference,denomination,insee,geo_point_2d' },
        CATALOG_MAX_BYTES,
      );
      return records
        .filter((r) => r.predefinedlocationreference)
        .map((r) => ({ r, axis: rennesAxis(r.denomination, r.insee) }))
        .filter(({ axis }) => axis)
        .map(({ r, axis }) => ({
          id: String(r.predefinedlocationreference),
          ...axis,
          ...point(r.geo_point_2d),
        }));
    },
    async live(fetch, ids) {
      const records = await liveRecords(
        fetch,
        'https://data.rennesmetropole.fr',
        'etat-du-trafic-en-temps-reel',
        'predefinedlocationreference',
        'predefinedlocationreference,trafficstatus,averagevehiclespeed,traveltime,datetime',
        ids,
      );
      return new Map(
        records.map((r) => {
          const speed = positive(r.averagevehiclespeed);
          const seconds = positive(r.traveltime);
          return [
            String(r.predefinedlocationreference),
            {
              status: RENNES_STATUS[r.trafficstatus] ?? STATUS.UNKNOWN,
              speed,
              time: seconds,
              usual: null,
              length: speed !== null && seconds !== null ? (speed / 3.6) * seconds : null,
              at: time(r.datetime),
            },
          ];
        }),
      );
    },
  },

  // data.nantesmetropole.fr, "Fluidité des axes routiers de Nantes
  // Métropole", about 900 segments, updated every few minutes.
  nantes: {
    name: 'Nantes Métropole',
    publisher: 'Nantes Métropole',
    dataset:
      'https://data.nantesmetropole.fr/explore/dataset/244400404_fluidite-axes-routiers-nantes-metropole/information/',
    hasSpeed: true,
    hasTravelTime: false,
    listAll: false,
    async catalog(fetch) {
      const records = await exportRecords(
        fetch,
        'https://data.nantesmetropole.fr',
        '244400404_fluidite-axes-routiers-nantes-metropole',
        { select: 'cha_id,cha_lib,geo_point_2d' },
        CATALOG_MAX_BYTES,
      );
      return records
        .filter((r) => num(r.cha_id) !== null && nantesAxis(r.cha_lib))
        .map((r) => ({
          id: num(r.cha_id),
          axisKey: slug(nantesAxis(r.cha_lib)),
          axisName: nantesAxis(r.cha_lib),
          ...point(r.geo_point_2d),
        }));
    },
    async live(fetch, ids) {
      const records = await liveRecords(
        fetch,
        'https://data.nantesmetropole.fr',
        '244400404_fluidite-axes-routiers-nantes-metropole',
        'cha_id',
        'cha_id,cha_long,mf1_hd,mf1_vit,tc1_temps,etat_trafic',
        ids,
      );
      return new Map(
        records.map((r) => [
          num(r.cha_id),
          {
            status: NANTES_STATUS[slug(r.etat_trafic)] ?? STATUS.UNKNOWN,
            speed: positive(r.mf1_vit),
            time: positive(r.tc1_temps),
            usual: null,
            length: positive(r.cha_long),
            at: time(r.mf1_hd),
          },
        ]),
      );
    },
  },

  // data.strasbourg.eu, "SIRAC - flux trafic en temps réel", about 480
  // sensors of the city traffic centre, updated every 3 minutes. The cycle
  // counters ("Cyc…") are left out. etat: 0 unknown, 1 free flow, 2 heavy,
  // 3 congested; etatexp 1: closed.
  strasbourg: {
    name: 'Strasbourg',
    publisher: 'Eurométropole de Strasbourg',
    dataset: 'https://data.strasbourg.eu/explore/dataset/sirac_flux_trafic/information/',
    hasSpeed: true,
    hasTravelTime: false,
    listAll: false,
    async catalog(fetch) {
      const records = await exportRecords(
        fetch,
        'https://data.strasbourg.eu',
        'sirac_flux_trafic',
        { select: 'ident,name,geo_point_2d' },
        CATALOG_MAX_BYTES,
      );
      return records
        .filter((r) => num(r.ident) !== null && strasbourgAxis(r.name) && !/^cyc/i.test(r.name))
        .map((r) => ({
          id: num(r.ident),
          axisKey: slug(strasbourgAxis(r.name)),
          axisName: strasbourgAxis(r.name),
          ...point(r.geo_point_2d),
        }));
    },
    async live(fetch, ids) {
      const records = await liveRecords(
        fetch,
        'https://data.strasbourg.eu',
        'sirac_flux_trafic',
        'ident',
        'ident,etat,etatexp,vitessebrp,ts',
        ids,
      );
      return new Map(
        records.map((r) => {
          const state = num(r.etat);
          const status =
            num(r.etatexp) === 1
              ? STATUS.CLOSED
              : [1, 2, 3].includes(state)
                ? state
                : STATUS.UNKNOWN;
          return [
            num(r.ident),
            {
              status,
              // 0 km/h on a heavy or congested arc is a standstill; on a free
              // flowing one (many at night), a silent loop: no measure.
              speed:
                status === STATUS.UNKNOWN
                  ? null
                  : status >= STATUS.HEAVY
                    ? num(r.vitessebrp)
                    : positive(r.vitessebrp),
              time: null,
              usual: null,
              length: null,
              at: time(r.ts),
            },
          ];
        }),
      );
    },
  },

  // opendata.bordeaux-metropole.fr, "Temps de parcours en temps réel": 16
  // routes of the metropolis, their travel time and its usual value, in
  // seconds, updated every 2.5 minutes. One small document: always read whole.
  bordeaux: {
    name: 'Bordeaux Métropole',
    publisher: 'Bordeaux Métropole',
    dataset: 'https://opendata.bordeaux-metropole.fr/explore/dataset/ci_tpstj_a/information/',
    hasSpeed: false,
    hasTravelTime: true,
    listAll: true,
    async catalog(fetch) {
      const records = await this.records(fetch);
      return records
        .filter((r) => num(r.bm_ident) !== null && r.bm_libelle)
        .map((r) => ({
          id: num(r.bm_ident),
          axisKey: String(num(r.bm_ident)),
          axisName: String(r.bm_libelle).trim(),
          lat: null,
          lon: null,
        }));
    },
    async live(fetch, ids) {
      const wanted = new Set(ids);
      const records = await this.records(fetch);
      return new Map(
        records
          .filter((r) => wanted.has(num(r.bm_ident)))
          .map((r) => {
            const actual = positive(r.bm_actuel);
            const usual = positive(r.bm_ref);
            return [
              num(r.bm_ident),
              {
                status: bordeauxStatus(actual, usual),
                speed: null,
                time: actual,
                usual,
                length: null,
                at: time(r.bm_mdate),
              },
            ];
          }),
      );
    },
    records(fetch) {
      return exportRecords(
        fetch,
        'https://opendata.bordeaux-metropole.fr',
        'ci_tpstj_a',
        { select: 'bm_ident,bm_libelle,bm_actuel,bm_ref,bm_mdate' },
        LIVE_MAX_BYTES,
      );
    },
  },
};

export const SOURCE_KEYS = Object.keys(SOURCES);
