# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.2.0] - 2026-10-31

### Added

- Lyon: the live traffic of the Métropole de Lyon (Criter, data.grandlyon.com),
  road by road and around the house, with the same level, average speed, data
  age and scene triggers as the other cities. The portal needs a free Grand
  Lyon data account: two optional settings (username, password), only for Lyon;
  the data portal password is distinct from GrandLyon Connect. Missing or
  refused credentials are said in the connection status and the Status action,
  and the other cities keep working.

## [1.1.0] - 2026-10-29

### Added

- National roads run by the State (DIR, Bison Futé open data): ring roads and
  expressways such as the Toulouse ring road (A620, A61, A621, A624), the N118
  or the N136. Tick "National roads (DIR)", type a road number or a city: one
  device per road, direction and département, with the same traffic level,
  average speed, data age and scene triggers as the cities, and the national
  roads around the house. The level is deduced from the speed (60 km/h or more
  free flow, 30 to 60 heavy, below 30 congested).

## [1.0.0] - 2026-10-29

### Added

- Live road traffic of Rennes Métropole, Nantes Métropole, Strasbourg and
  Bordeaux Métropole, from their open data portals: no account, no key.
- One device per road followed, found by typing part of its name: traffic
  level and its name (free flow, heavy, congested, closed), average speed or
  travel time and its usual value (Bordeaux), age of the measure.
- An "Around the house" device per city: the segments within 500 m to 3 km of
  the house located in Gladys.
- A "Road traffic" dashboard widget, one colored row per road.
- Scene triggers: a road turns heavy or congested, a road flows freely again.
- Scene action: the traffic on your roads in one sentence, with the worst
  level and the number of roads jammed.
- A "Status" action: cities read, roads known, last readings and errors.
- Feature names, messages and documentation in English, French, German and
  Spanish.

[Unreleased]: https://github.com/guim31/gladys-trafic/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/guim31/gladys-trafic/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/guim31/gladys-trafic/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/guim31/gladys-trafic/releases/tag/v1.0.0
