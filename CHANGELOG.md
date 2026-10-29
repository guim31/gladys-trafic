# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

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

[Unreleased]: https://github.com/guim31/gladys-trafic/commits/main
