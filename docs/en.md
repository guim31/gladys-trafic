# Road traffic

The **live road traffic** of several French metropolises, read from their open data portals: Rennes
Métropole, Nantes Métropole, Strasbourg and Bordeaux Métropole. Free flow, heavy, congested or
closed, road by road, and around your house. **No account, no key.**

Unofficial integration, not affiliated with the metropolises or their traffic centres. The sources
were checked live on 2026-10-29; feedback from users of each city is welcome.

## What you get

- One **device per road** you follow: traffic level and its name (free flow, heavy, congested,
  closed), average speed (Rennes, Nantes, Strasbourg) or travel time and its usual value
  (Bordeaux), and the age of the measure.
- One **"Around the house" device** per city: the road segments within the chosen distance of the
  house located in Gladys, gathered in a single level.
- A **widget** "Road traffic": your roads on one row each, green, orange or red.
- Two **scene triggers**: a road turns heavy or congested, a road flows freely again.
- A **scene action**: the traffic on your roads in one sentence, ready to send or to say.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from Gladys: the data comes from the open data portals.
- No account, no API key. For the "Around the house" device, a house located in Gladys
  (Settings → Houses): the integration asks for access to its location at install.

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Paste the address `https://github.com/guim31/gladys-trafic` and confirm.
3. Open the integration once installed: the **Configuration** tab shows.

## Configuration

### Settings

| Setting                        | Effect                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| Cities                         | the metropolises whose roads are offered in the Discover tab               |
| Roads to follow                | part of the names of your roads, separated by commas (3 letters at least)  |
| Around the house               | off, 500 m, 1 km (default), 2 km or 3 km around the house                  |
| Refresh                        | every 2, 3 (default) or 5 minutes                                          |
| Language of names and messages | language of the feature names, the widget and the scene sentences (French) |

Feature names are fixed when a device is added: pick the language first.

### Add roads

1. Tick one or more cities and type the roads you take, for example
   `Route nationale 136, Patton, Schirmeck`. Upper case and accents do not matter. Save.
2. Open the **Discover** tab: the matching roads show as "City · Road" (50 per city at most), with
   "City · Around the house" when segments lie within the chosen distance. For Bordeaux, the 16
   routes are always offered.
3. Add the ones you want to Gladys. Their values arrive at once.

The roads added are the **watched roads**: the widget, the triggers and the scene action offer
them. A road added stays read even if you change the search afterwards.

A "road" gathers every segment of the portal bearing that name: in Rennes, a national or
departmental road across communes, a street within its commune (the commune is in the name); in
Nantes, both directions of a boulevard; in Strasbourg, one measuring point of the traffic centre.

### Check

The **Status** action of the Configuration tab lists the cities read, the number of roads known,
the time of the last reading, the last error if any, the segments around the house and the number
of roads added.

## Devices

Each road added is a read-only device:

| Feature           | Gladys type        | Value                                                  |
| ----------------- | ------------------ | ------------------------------------------------------ |
| Traffic           | text               | Free flow, Heavy, Congested, Closed or Unknown         |
| Traffic level     | risk level         | 0 unknown, 1 free flow, 2 heavy, 3 congested, 4 closed |
| Average speed     | speed (km/h)       | Rennes, Nantes, Strasbourg                             |
| Travel time       | duration (minutes) | Bordeaux: travel time of the route                     |
| Usual travel time | duration (minutes) | Bordeaux: the reference value published with it        |
| Data age          | duration (minutes) | age of the newest measure                              |

The **level of a road** is the worst level met on **a quarter of its length** at least (each
segment counts once in Strasbourg, which does not publish lengths): one jammed crossroads does not
make the whole ring road congested. The **average speed** is the length of the road divided by its
travel time.

Without any measure **less than 30 minutes old**, the road is **Unknown** (level 0): no value is
made up, the speed keeps its last known value and the data age keeps growing.

## Dashboard widget

Add the **Road traffic** widget to a dashboard. It shows one row per watched road (ten at most),
with the name given in Gladys, for example "Rocade — Heavy · 42 km/h". In the widget settings you
can pick the roads shown (empty: all of them) and hide the speed or the travel time.

Colors: **green** free flow, **orange** heavy, **red** congested or closed, **grey** unknown.

## Scene triggers

| Trigger               | Happens when                                                  |
| --------------------- | ------------------------------------------------------------- |
| Traffic jam on a road | a watched road reaches the chosen level: heavy, or congested  |
| Road clear again      | a watched road that was heavy or congested flows freely again |

The **Roads** field filters the roads concerned; empty, any watched road. The variables available
to the next actions: road, city, traffic (the level as a word), average speed.

Triggers compare two successive known levels of the road: nothing fires when a portal comes back
after a long outage, nor while the road is unknown.

## Scene action

**Traffic in one sentence**: the state of your watched roads (or the ones picked). Results:

- `sentence`: "Traffic: Rocade (heavy, 42 km/h). Free flow elsewhere.", or "Traffic is flowing
  freely on your 3 watched roads.";
- `worst_level`: the worst level, 0 to 4 (to test with "Continue only if");
- `jammed`: the number of roads heavy or worse.

The sentence follows the language chosen in the configuration.

## Scene examples

- **Before leaving for work**: at 7:30 on weekdays, action "Traffic in one sentence", then "Send a
  message" with `sentence`, or say it on a speaker.
- **Ring road jammed**: trigger "Traffic jam on a road" (ring road, congested), then a notification
  "Leave earlier or take the train".
- **The road is clear**: trigger "Road clear again" on the road home, then a message.

## Data and refresh

| City       | Portal and dataset                                                | Updated by the city | Segments  |
| ---------- | ----------------------------------------------------------------- | ------------------- | --------- |
| Rennes     | data.rennesmetropole.fr, "État du trafic en temps réel"           | every few minutes   | ~2,900    |
| Nantes     | data.nantesmetropole.fr, "Fluidité des axes routiers"             | every few minutes   | ~890      |
| Strasbourg | data.strasbourg.eu, "SIRAC - flux trafic en temps réel"           | every 3 minutes     | ~480      |
| Bordeaux   | opendata.bordeaux-metropole.fr, "Temps de parcours en temps réel" | every 2.5 minutes   | 16 routes |

The list of the segments (names, positions) is read **once a day** per city. At each refresh, one
request per city reads **only the segments of the roads added**, filtered by the portal itself (one
more request per hundred segments): a few kilobytes, about 500 requests a day per city at 3
minutes, well within the anonymous use of the Opendatasoft portals. Only the cities ticked and
those of the roads added are read.

Bordeaux publishes no status: the level is computed from the travel time compared with its usual
value (up to 1.3 times: free flow, up to 1.8 times: heavy, above: congested). Nantes "blocked"
segments count as congested. The cycle counters of Strasbourg are left out.

## Troubleshooting

- **No road in Discover**: check that a city is ticked and a road typed (3 letters at least), then
  run the **Status** action. An "HTTP 503" or "timeout" error comes from the portal: try again
  later.
- **No "Around the house" device**: the house has no location in Gladys, or no segment lies within
  the chosen distance: try a larger one. The Status action says how many segments were found.
- **"Unknown" level**: the portal has published no measure for this road for more than 30 minutes
  (at night, some segments are not measured).
- For more details, set `LOG_LEVEL=debug`: every reading is then logged.

## Limitations

- Only the cities listed are supported. **Lyon** now requires an account for its traffic feed,
  **Grenoble** publishes levels without the names of the segments, **Paris** and **Toulouse** only
  publish hourly or archived counts: these cities can be added if their data allows it.
- The roads are the portals' own segments and names: a road renamed by the city becomes a new
  device.
- The levels are the cities' own (floating car data in Rennes, sensors elsewhere): they may differ
  from a navigation app.
- Read only. Not affiliated with the metropolises.

## Credits

- Data: Rennes Métropole, Nantes Métropole, Eurométropole de Strasbourg (SIRAC), Bordeaux
  Métropole, under their respective open licences (Licence Ouverte / ODbL). Commune names: geo.api.gouv.fr.
- Built from the official
  [integration template](https://github.com/GladysAssistant/integration-template-js).
