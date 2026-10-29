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
// A segment may also carry `axisNames` ({ en, fr, de, es }: the name of its
// road in each language, for the device name) and `search` (more words the
// road search of the configuration matches).
//
// Every source below was checked live on 2026-10-29 (test/fixtures/sources
// holds those answers). Keys are part of the device external ids: never
// rename one.
// -----------------------------------------------------------------------------

import { getBuffer, getJson, streamText } from './http.js';
import { DIRECTIONS } from './messages.js';

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

// --- National roads (DIR) ------------------------------------------------------

const DIR_BASE = 'https://tipi.bison-fute.gouv.fr/bison-fute-ouvert/publicationsDIR/QTV-DIR';
// 1,400 points: about 120 KB of CSV and 1.5 MB of XML in October 2026.
const DIR_CATALOG_MAX_BYTES = 2e6;
const DIR_LIVE_MAX_BYTES = 20e6;
// A <siteMeasurements> block is about 1 KB: a longer text without one is no
// DATEX II measure file.
const DIR_MAX_PENDING = 1e6;

// The speed thresholds of the national roads, in km/h: the source publishes
// speeds, no status. At or above 60 free flow, from 30 heavy, below congested
// (said in the docs).
export const DIR_FREE_KMH = 60;
export const DIR_HEAVY_KMH = 30;

/**
 * The status of a national road measuring point, from its speed. 0 km/h is
 * no measure: an empty road at night, or a faulty loop (on 2026-10-29 at
 * 16:48, 14 points said 0 km/h with up to 27,100 vehicles per hour counted).
 */
export function dirStatus(speed) {
  if (speed === null || speed <= 0) {
    return STATUS.UNKNOWN;
  }
  if (speed >= DIR_FREE_KMH) {
    return STATUS.FREE;
  }
  return speed >= DIR_HEAVY_KMH ? STATUS.HEAVY : STATUS.CONGESTED;
}

// The traffic-information areas of the reference file (code_traficolor): the
// conurbation named in the road name.
const DIR_AREAS = {
  BR19: 'Brive',
  BX33: 'Bordeaux',
  CA14: 'Caen',
  CH36: 'Châteauroux',
  GR38: 'Grenoble',
  LI87: 'Limoges',
  LY69: 'Lyon',
  MA13: 'Marseille',
  PO86: 'Poitiers',
  RO76: 'Rouen',
  ST42: 'Saint-Étienne',
  TO31: 'Toulouse',
};

/** "N136" from "N0136", "A620" from "A620": the road number without its padding. */
export const dirRoad = (axe) =>
  String(axe ?? '')
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]+)0+(?=\d)/, '$1');

/**
 * The direction of a point: the ring of a ring road (inner, outer), else the
 * cardinal direction, else the operator's direction (1 or 2), else none.
 */
export function dirDirection(row) {
  const ring = { INTERIEUR: 'int', EXTERIEUR: 'ext' }[row.sens_giratoire];
  const cardinal = { NORD_SUD: 'n-s', SUD_NORD: 's-n', EST_OUEST: 'e-w', OUEST_EST: 'w-e' }[
    row.sens_cardinal
  ];
  const operator = { 1: 's1', 2: 's2' }[row.sens_gestionnaire];
  return ring ?? cardinal ?? operator ?? null;
}

/** The département of a point: from its commune (INSEE code at the end of source_2), else its PR. */
export function dirDepartment(row) {
  const insee = /(\d[\dAB]\d{3})$/.exec(row.source_2 ?? '')?.[1];
  if (insee) {
    return insee.slice(0, 2);
  }
  return /^(\d{2}|2[AB])PR/i.exec(row.pr_debut ?? '')?.[1]?.toUpperCase() ?? null;
}

/** Latitude and longitude of a Lambert-93 point (EPSG:2154, IGN's inverse projection). */
export function lambert93ToWgs84(x, y) {
  const n = 0.725607765053267;
  const c = 11754255.426096;
  const xs = 700000;
  const ys = 12655612.049876;
  const e = 0.0818191910428158;
  const lon0 = (3 * Math.PI) / 180;
  const dx = x - xs;
  const dy = ys - y;
  const r = Math.hypot(dx, dy);
  const gamma = Math.atan(dx / dy);
  const latIso = -Math.log(r / c) / n;
  let phi = 2 * Math.atan(Math.exp(latIso)) - Math.PI / 2;
  for (let i = 0; i < 10; i += 1) {
    const sin = e * Math.sin(phi);
    phi = 2 * Math.atan(((1 + sin) / (1 - sin)) ** (e / 2) * Math.exp(latIso)) - Math.PI / 2;
  }
  return { lat: (phi * 180) / Math.PI, lon: ((lon0 + gamma / n) * 180) / Math.PI };
}

// The fields of refDir.csv. Its header names one more column than its rows
// hold (October 2026: code_insee_commune has no value column): rows one field
// short are read without it.
const DIR_SHORT_ROW_DROPS = 'code_insee_commune';

/** The rows of refDir.csv as objects keyed by the header names. */
export function parseDirCsv(text) {
  const [head, ...rows] = String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const header = (head ?? '').split(';').map((name) => name.trim());
  const short = header.filter((name) => name !== DIR_SHORT_ROW_DROPS);
  return rows.map((line) => {
    const fields = line.split(';');
    const names = fields.length === header.length - 1 ? short : header;
    return Object.fromEntries(names.map((name, i) => [name, (fields[i] ?? '').trim()]));
  });
}

/**
 * The catalog of the national roads: one road per number, département and
 * direction ("A620 Toulouse · intérieur"). Points without a road are left out.
 */
export function dirCatalog(rows) {
  const segments = [];
  for (const row of rows) {
    const road = dirRoad(row.axe);
    if (!row.code_pme || !/^[A-Z]+\d/.test(road)) {
      continue;
    }
    const department = dirDepartment(row);
    const direction = dirDirection(row);
    const x = [num(row.x_deb), num(row.x_fin)];
    const y = [num(row.y_deb), num(row.y_fin)];
    const located = [...x, ...y].every((v) => v !== null && v > 0);
    segments.push({
      id: row.code_pme,
      axisKey: slug([road, department ?? '', direction ?? ''].filter(Boolean).join('-')),
      road,
      department,
      direction,
      area: DIR_AREAS[row.code_traficolor] ?? null,
      length: positive(row.longueur),
      ...(located
        ? lambert93ToWgs84((x[0] + x[1]) / 2, (y[0] + y[1]) / 2)
        : { lat: null, lon: null }),
    });
  }
  // The area of a road: the most frequent one of its points (some have none).
  const areas = new Map();
  for (const s of segments.filter((segment) => segment.area)) {
    const counts = areas.get(s.axisKey) ?? new Map();
    counts.set(s.area, (counts.get(s.area) ?? 0) + 1);
    areas.set(s.axisKey, counts);
  }
  const areaOf = (key) =>
    [...(areas.get(key) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return segments.map(({ id, axisKey, road, department, direction, lat, lon, length }) => {
    const area = areaOf(axisKey);
    const place = area ?? (department ? `(${department})` : '');
    const names = Object.fromEntries(
      Object.entries(DIRECTIONS).map(([language, words]) => [
        language,
        [`${road}${place ? ` ${place}` : ''}`, direction ? words[direction] : null]
          .filter(Boolean)
          .join(' · '),
      ]),
    );
    return {
      id,
      axisKey,
      axisName: names.fr,
      axisNames: names,
      search: Object.values(names).join(' '),
      lat,
      lon,
      length,
    };
  });
}

/**
 * The measures of some points of qtvDir.xml (DATEX II 2.0
 * MeasuredDataPublication), read piece by piece: each <siteMeasurements>
 * block is parsed and dropped, only the points wanted are kept.
 */
export class DirMeasureParser {
  constructor(wanted, lengths = new Map()) {
    this.wanted = wanted;
    this.lengths = lengths;
    this.pending = '';
    this.measures = new Map();
    this.blocks = 0;
  }

  push(text) {
    this.pending += text;
    for (;;) {
      const end = this.pending.indexOf('</siteMeasurements>');
      if (end === -1) {
        break;
      }
      this.block(this.pending.slice(0, end));
      this.blocks += 1;
      this.pending = this.pending.slice(end + '</siteMeasurements>'.length);
    }
    if (this.pending.length > DIR_MAX_PENDING) {
      throw new Error('not a DATEX II measure file');
    }
  }

  block(text) {
    const id = /<measurementSiteReference\b[^>]*\bid="([^"]*)"/.exec(text)?.[1];
    if (!id || !this.wanted.has(id)) {
      return;
    }
    const value = (tag) => num(new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(text)?.[1]);
    const speed = value('speed');
    const status = dirStatus(speed);
    this.measures.set(id, {
      status,
      speed: status === STATUS.UNKNOWN ? null : Math.round(speed * 10) / 10,
      time: null,
      usual: null,
      length: this.lengths.get(id) ?? null,
      at: time(/<measurementTimeDefault>([^<]*)</.exec(text)?.[1]),
    });
  }
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

// The national roads of the DIR (Directions interdépartementales des routes),
// "État de circulation en temps réel sur le réseau national routier non
// concédé" (Point d'accès national, data.gouv.fr): about 1,400 measuring
// points (flow, speed) every 6 minutes. The reference file (refDir.csv) is the
// catalog; the measure file (qtvDir.xml, 1.5 MB, every point) is read as a
// stream at most once per publication (ETag), only the points followed kept.
SOURCES.dir = {
  name: 'Routes nationales (DIR)',
  publisher: 'Ministère chargé des transports (DIR, Bison Futé)',
  dataset:
    'https://transport.data.gouv.fr/datasets/etat-de-circulation-en-temps-reel-sur-le-reseau-national-routier-non-concede',
  hasSpeed: true,
  hasTravelTime: false,
  listAll: false,
  // `state` is the city's own memory (src/service.js): `lengths` of the
  // points from the catalog, `cache` { since, signature, measures } of the
  // last file read.
  async catalog(fetch, state = {}) {
    const { body } = await getBuffer(fetch, `${DIR_BASE}/refDir.csv`, {
      maxBytes: DIR_CATALOG_MAX_BYTES,
      accept: 'text/csv',
    });
    const segments = dirCatalog(parseDirCsv(body.toString('utf8')));
    state.lengths = new Map(segments.map((segment) => [segment.id, segment.length]));
    return segments;
  },
  async live(fetch, ids, state = {}) {
    const wanted = new Set(ids.map(String));
    const signature = [...wanted].sort().join(',');
    const cached = state.cache?.signature === signature ? state.cache : null;
    const parser = new DirMeasureParser(wanted, state.lengths);
    // Same points as last time: a file not republished since is not read again.
    const { lastModified, notModified } = await streamText(
      fetch,
      `${DIR_BASE}/qtvDir.xml`,
      { maxBytes: DIR_LIVE_MAX_BYTES, since: cached?.since ?? null, timeoutMs: 60000 },
      (text) => parser.push(text),
    );
    if (notModified) {
      return cached.measures;
    }
    if (parser.blocks === 0) {
      throw new Error('no measure in the national roads file');
    }
    state.cache = { since: lastModified, signature, measures: parser.measures };
    return parser.measures;
  },
};

export const SOURCE_KEYS = Object.keys(SOURCES);
