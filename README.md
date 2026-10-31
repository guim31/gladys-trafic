# Gladys Road traffic

External integration for [Gladys Assistant](https://gladysassistant.com): the
**live road traffic** of French metropolises, road by road, read from their
open data portals: **Rennes Métropole, Nantes Métropole, Strasbourg** and
**Bordeaux Métropole** (travel times of 16 routes), **Lyon** (with a free
Grand Lyon data account), and the **national roads** run by the State's DIR
(ring roads and expressways: Toulouse ring road, N118, N136…). No account, no
key, except for Lyon.

Unofficial: not affiliated with the metropolises or their traffic centres. The
four sources were checked live on 2026-10-29, not yet on many Gladys
installations: feedback welcome.

Not to be confused with
[gladys-bison-fute](https://github.com/William-De71/gladys-bison-fute) (events
on the national road network) nor
[Gladys-mapbox-traffic](https://github.com/quentinlegay/Gladys-mapbox-traffic)
(travel times computed by Mapbox, with a key): this one reads the level of
traffic the cities themselves publish, segment by segment.

User documentation: [English](docs/en.md) · [français](docs/fr.md) ·
[Deutsch](docs/de.md) · [español](docs/es.md).

## What you get in Gladys

| Kind                 | Content                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Devices              | one per road followed: level (free flow → closed), average speed or travel time, data age      |
| Around the house     | one device per city: the segments within 500 m to 3 km of the house located in Gladys          |
| Dashboard widget     | "Road traffic": one row per road, green, orange or red                                         |
| Scene triggers       | a road turns heavy or congested / flows freely again                                           |
| Scene action         | the traffic on your roads in one sentence, with the worst level and the number of roads jammed |
| Configuration action | status: cities read, roads known, last readings, errors                                        |

Requires Gladys **5.3.0** or later.

## Installation

In Gladys: **Integrations → Install from GitHub**, then
`https://github.com/guim31/gladys-trafic`. Tick your cities, type part of the
names of your roads in the configuration, then add them from the **Discover**
tab.

## How it works

- One adapter per portal (`src/sources.js`), all Opendatasoft Explore v2.1.
- The list of the segments (names, positions) is read once a day. At each
  refresh (2, 3 or 5 minutes), one request per city reads only the segments of
  the roads added, filtered by the portal (`where=id in (...)`). Devices are
  published with `should_poll: false`: the container runs its own timer.
- The level of a road is the worst one met on a quarter of its length at least.
  A measure older than 30 minutes does not count: without any, the road is
  "unknown" and nothing is made up.

| City                 | Dataset                                                                                                                                                                                              | Updated           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Rennes               | [État du trafic en temps réel](https://data.rennesmetropole.fr/explore/dataset/etat-du-trafic-en-temps-reel/information/)                                                                            | every few minutes |
| Nantes               | [Fluidité des axes routiers](https://data.nantesmetropole.fr/explore/dataset/244400404_fluidite-axes-routiers-nantes-metropole/information/)                                                         | every few minutes |
| Strasbourg           | [SIRAC - flux trafic en temps réel](https://data.strasbourg.eu/explore/dataset/sirac_flux_trafic/information/)                                                                                       | every 3 minutes   |
| Bordeaux             | [Temps de parcours en temps réel](https://opendata.bordeaux-metropole.fr/explore/dataset/ci_tpstj_a/information/)                                                                                    | every 2.5 minutes |
| Lyon                 | [État du trafic temps réel](https://www.data.gouv.fr/datasets/etat-du-trafic-de-la-metropole-de-lyon-disponibilites-temps-reel) (data.grandlyon.com, account required)                               | every minute      |
| National roads (DIR) | [État de circulation en temps réel sur le réseau national routier non concédé](https://transport.data.gouv.fr/datasets/etat-de-circulation-en-temps-reel-sur-le-reseau-national-routier-non-concede) | every 6 minutes   |

## Limitations

- **Grenoble** publishes levels without the names of the segments, **Paris**
  and **Toulouse** only publish hourly or archived counts: their city streets
  are not supported for now (the Toulouse ring road is, as a national road).
- **Lyon** needs a free Grand Lyon data account: username and password in the
  settings, the data portal password being distinct from GrandLyon Connect. A
  road gathers every segment of the same label, whatever the commune.
- Bordeaux publishes no level: it is computed from the travel time compared
  with its usual value.
- The national roads publish speeds, no level: 60 km/h or more is free flow,
  30 to 60 heavy, below 30 congested. Only the ~1,000 measuring points of the
  DIR (no toll motorways). Developed without driving there: feedback welcome.
- The roads are the portals' own segments and names: a road renamed by the city
  becomes a new device.
- Read only.

## Development

```bash
npm install
npm test               # node --test, no network access
npm run lint           # ESLint
npm run format:check   # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store .   # store admission checks
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the conventions. The test
fixtures (`test/fixtures/sources`) are the real answers of the four portals and
of the national roads files, captured on 2026-10-29 (a subset of the segments).

## Credits

- Data: Rennes Métropole, Nantes Métropole, Eurométropole de Strasbourg
  (SIRAC) and Bordeaux Métropole, under their open licences (Licence Ouverte /
  ODbL). Commune names of Rennes Métropole: geo.api.gouv.fr.
- Lyon: Métropole de Lyon (Criter traffic centre), data.grandlyon.com, under
  the terms of its data platform.
- National roads: Directions interdépartementales des routes (DIR), French
  ministry of transport, through the National Access Point
  (transport.data.gouv.fr), Licence Ouverte. Lambert-93 projection: IGN
  formulas.
- Built from the official
  [integration template](https://github.com/GladysAssistant/integration-template-js).

## License

[Apache 2.0](LICENSE).
