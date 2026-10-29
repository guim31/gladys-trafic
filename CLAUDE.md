# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration**: a Node.js service (Node 22+, ESM,
no build step) that runs in its own sandboxed Docker container and talks to
Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/devices.test.js          # one file
node --test --test-name-pattern "plug"    # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: registerHandlers() then connect()
src/app.js                        every SDK handler -> service; configuration action
src/service.js                    catalogs, live reads, timer, discovery, states, triggers, status
src/sources.js                    one adapter per open data portal -> segments and measures
src/devices.js                    the Gladys device of a road, aggregation of its segments, states
src/scenes.js                     scene action handler (manifest `scene_actions`)
src/widgets.js                    dashboard widget handler (manifest `widgets`)
src/http.js                       downloads: timeouts, size caps, conditional reads, text streams
src/messages.js                   texts sent from the container (en, fr, de, es)
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
gladys-assistant-integration.json manifest: config, action, widget, scene triggers and action
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (en and fr mandatory)
test/                             node --test, against the SDK's fake Gladys (integration-sdk/testing)
test/helpers/world.js             fake Gladys + fake ODS exports and DIR files on the fixtures + manual clock
test/fixtures/sources             real answers of the four portals (2026-10-29, ~11:59 Paris)
                                  and of the DIR files (dir-*, 17:00 Paris, moved to the same clock)
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** Build them with
  `gladys.externalIds(type, platformId)`, `platformId` being the unique id the
  platform gives the device (serial, cloud id, MAC), never a label. Gladys keys
  devices, their history, scenes and dashboards on them: changing one creates a
  new device and orphans the old one. The same goes for every key users store:
  manifest `config_schema`, `actions`, widget and scene keys, feature keys.
- **The container rootfs is read-only.** Write only under `/data`, the one
  writable volume. Never log tokens, passwords or API keys.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand — except on the README's hand-pushed tag path, which bumps all three
  together before tagging. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section, and it
  becomes the notes of the GitHub Release.
- **Manifest.** Texts are multi-language objects `{ "en": ..., "fr": ... }`:
  `label`, `description` and `placeholder` alike, never a plain string. The
  catalog `description` holds 10 to 100 characters per language. A field the
  older cores do not know needs a higher `gladys_version` minimum
  (`categories`: 4.86.0; `widgets`, `scene_triggers`, `scene_actions`,
  `type: "provider"`: 5.1.0). `test/manifest.test.js` ties the manifest to the
  code (defaults, action, scene and widget handlers): change both sides
  together.
- **User-facing text** is in four languages (English, French, German,
  Spanish): action messages, manifest texts, and `docs/{en,fr,de,es}.md`,
  kept in sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.

---

# Notes du mainteneur (guim31)

Ce qui suit complète les règles du template ci-dessus. Ce sont des faits vérifiés dans le code du
cœur Gladys ou payés sur les intégrations déjà publiées par guim31. Ils ne se lisent pas dans le
code de ce dépôt. Compléter ce fichier quand un nouveau piège est découvert.

## Travailler sur ce dépôt

- Mêmes étapes que la CI, dans le même ordre : `npm ci`, `npm run format:check`, `npm run lint`,
  `npm test`. Prettier contrôle **aussi le Markdown** : lancer `npm run format` après avoir
  modifié ce fichier, le README ou la documentation, sinon la CI tombe.
- Une session de code n'a **ni instance Gladys ni appareil réel**. La suite de tests, le lint et
  le validateur du store sont les seules vérifications possibles : le test réel se fait ailleurs.
  Le dire, plutôt que de conclure que « ça marche ».
- **Tout le code de démonstration du template disparaît** : station météo, prise, lampe, caméra,
  capteur de mouvement, `src/weather.js`, leurs tests, leurs entrées du manifeste et de la
  documentation. Il ne reste que ce que l'intégration fait vraiment.
- **Publier n'est jamais le travail d'une session de code** : ni Release, ni tag, ni topic, ni
  version modifiée à la main. L'orchestrateur s'en charge une fois la PR fusionnée. Les workflows
  sont ceux du template : ne pas les modifier.
- Le dépôt est **public** : aucun secret, aucune adresse ni détail d'infrastructure privée, ni
  ici, ni dans les tests, ni dans les captures.

## Pièges du cœur Gladys

**Appareils et fonctionnalités**

- **Polling** : le planificateur n'interroge un appareil que si `should_poll: true` **et**
  `poll_frequency` vaut une valeur de la liste fixe, **en millisecondes** (1000, 2000, 10000,
  15000, 30000, 60000). Le template publie `poll_frequency: 300` sans `should_poll` : c'est faux,
  le cœur répond 400 à la découverte. Pour une cadence hors liste, publier `should_poll: false` et
  pousser les états depuis le conteneur, en gardant un `onPoll` de repli.
  **Piège du 5.2.0** (GladysAssistant/Gladys#3198, correctif #3199, relevé sur gladys-ping-wol) :
  un appareil **créé sans `should_poll`** n'est jamais sondé, même après correction du cœur (valeur
  stockée à la création), et la 5.2.1 du 13/10/2026 ne le corrige pas. **Le conteneur sonde donc
  lui-même** par un minuteur, qui saute un appareil sondé il y a moins d'une demi-période, en gardant
  `onPoll` comme repli ; seuls les appareils ajoutés (`gladys.devices`) sont lus. Un test le prouve
  sans appeler `onPoll`.
- **`min` et `max` sont NOT NULL** dans `t_device_feature`, y compris pour `text/text` : sans eux,
  « Ajouter à Gladys » échoue en HTTP 422. Mettre 0/0, comme Zigbee2MQTT.
- Un état publié sur une fonctionnalité **pas encore ajoutée** dans Gladys reçoit un 200 puis est
  jeté (simple ligne de log) : republier les états dans `onDeviceCreated`.
- `level-sensor/decimal` n'existe pas côté serveur. `light-sensor/binary` n'a pas de libellé dans
  le front (pastille vide) : préférer `input/binary`. Un `text/text` reçoit `{ text }`, jamais
  vide, sinon l'état est ignoré.
- **Détecteur d'ouverture (`opening-sensor`) : 0 = ouvert, 1 = fermé** (`OPENING_SENSOR_STATE`), à
  l'inverse de l'intuition et des autres détecteurs (mouvement, fuite, fumée : 1 = détecté). Une
  porte ouverte publiée à 1 s'affiche « Fermé » et fausse scènes et historique. Le figer par un test.
- **Un `external_id` de fonctionnalité ne change jamais d'appareil** d'une version à l'autre. UniFi
  1.5.2 avait sorti les ports PoE dans un appareil dédié, la 1.6.0 les a remis dans la passerelle avec
  les mêmes identifiants : ceux qui avaient ajouté l'appareil dédié ne peuvent plus « Mettre à jour » la
  passerelle (409 `external_id must be unique`). Pour regrouper, garder l'appareil existant
  (`gladys.getDevices()`) ou changer d'identifiant.
- Les **noms de fonctionnalités sont figés à la création**. Et quand une fonctionnalité est seule
  de son type sur l'appareil, le tableau de bord affiche le libellé générique du type à la place
  du nom publié.
- **Aucune commande d'appareil ne permet un choix multiple** : un `text/select` n'a qu'un choix
  actif.
- Un changement de structure fait proposer « Mettre à jour » dans l'onglet Découverte
  (`structure_changed`). Un changement des seules `supported_options` ne le déclenche pas.
- **Jauge** : l'aiguille se place par `(value - min) / (max - min)` des bornes de la
  fonctionnalité. `gauge_min`/`gauge_max` ne pilotent que les couleurs, et le cœur n'applique
  jamais `min`/`max` en écriture : ce sont des bornes d'affichage. Une valeur signée exige des
  bornes symétriques.
- Le cœur plafonne à **300 états par minute** et réévalue les scènes à chaque état : ne publier
  que les changements.
- Une intégration `device` ne reçoit pas la langue de l'utilisateur, une action de scène non
  plus (un widget, si) : prévoir un champ de config `language` si des textes partent du
  conteneur. Le superviseur injecte `TZ`, le fuseau de Gladys. La sandbox est limitée à 256 Mo.

**Statut, horloge, caméras, image**

- `setConnectionStatus(false, message)` reçoit **l'objet `{ en, fr, de, es }`**, jamais `message[language]` : le
  cœur 5.2+ répond 400 à une chaîne et l'erreur est avalée (WeeWX 1.0.1).
- Le code testé ne lit jamais `Date.now()` en direct : horloge injectable ; un test ne dépend pas de la date du jour
  (Bourse : test rouge dix jours après la date de ses fixtures).
- **`camera/enabled` n'est pas « en ligne »** : dans le cœur 5.2+ c'est le mode privé de l'utilisateur (à 0, plus
  d'image ni d'action « Envoyer une image », `publishCameraImage` en 404). L'état en ligne passe par
  `publishTransports` et un déclencheur `camera_offline` (voir gladys-shinobi).
- Une dépendance d'exécution déclarée en `devDependencies` passe les tests mais manque dans l'image (LinkPlay
  1.1.0) : construire l'image et y importer `src/app.js` avant de rendre la main.
- Service régional (météo, transports, qualité de l'air d'un pays) : `countries` dans le manifeste (GIOŚ 1.0.1).

**Formulaires de configuration et actions**

- Les champs `number` sont rendus **sans `step`** : le navigateur n'accepte alors que `min + k`.
  Min et défaut **entiers** seulement ; une valeur décimale passe par un `select` ou par un
  `string` parsé (virgule acceptée).
- Un champ `secret` dans les `fields` d'une **action** est impossible à remplir, et une action
  n'applique **aucun `default`** tout en exigeant les champs `required` (422). Issues
  GladysAssistant/Gladys#3154 et #3155.

**SDK et journaux**

- SDK `@gladysassistant/integration-sdk` **^0.16.0** (25/10/2026, Gladys 5.3 : lecteur de musique, types `ai` et
  `tts`) ; depuis 0.15 : `DEVICE_POLL_FREQUENCIES`, faux
  Gladys de test (`@gladysassistant/integration-sdk/testing`, à préférer à un faux maison),
  déduplication des états, `parseMdnsTxt`. Lire son README et son CHANGELOG.
- **Journaux calmes** (demande de Guilhem, 13/10/2026) : rien au niveau info pour un cycle normal de
  lecture, un état publié ou un message reçu. L'info ne garde que le cycle de vie : démarrage,
  connexion, perte et retour d'un appareil ou d'un service, erreurs utiles, une ligne par action de
  l'utilisateur. Le reste passe en debug (`LOG_LEVEL=debug`). Une erreur qui se répète écrit une ligne
  au premier échec et une au rétablissement, pas une par tentative. Jamais de secret ni d'adresse
  avec identifiants. Un test vérifie qu'un cycle normal n'écrit rien en info.
- **Heartbeat** : republier au moins toutes les 12 h une valeur qui ne change pas, sinon le front
  affiche « Pas de valeur récente » au-delà de 48 h.

**Widgets, déclencheurs, actions de scène (SDK ≥ 0.14, Gladys ≥ 5.1)**

- **Cibler la dernière version publiée du cœur (5.3.0 le 25/10/2026), pas `master`** : la spec de `master` décrit
  des fonctions non publiées. Vérifier par `git tag --contains`. Les boutons de widget qui ouvrent un formulaire
  (#3168) demandent `gladys_version >=5.2.0` ; `countries` et `keywords` du manifeste, `>=5.3.0`.
- Un widget affiche le **nom donné dans Gladys** (`gladys.devices[].name`, tenu à jour par le SDK), pas celui de
  l'API, et demande un rafraîchissement sur `onDeviceUpdated` / `onDeviceDeleted` (IRVE 1.0.1).
- Chaque bouton ou bloc facultatif d'un widget a un **réglage pour le masquer** (`boolean` ou `multi_select`, dès
  5.1) : Bbox, Speedtest et devolo l'ont demandé après publication.

- Un réglage de widget ne propose en liste que les **appareils** de l'intégration
  (`source: "devices"`, seule source dynamique).
- Budget du cœur : **8 composants par widget, dont 2 textes au plus**, appliqué **avant** la
  résolution des références ; un contenu amputé reste en cache jusqu'au TTL. Appeler
  `requestWidgetRefresh` à la création d'un appareil. `validateWidgetContent` est exporté pour les
  tests, mais ne vérifie pas que les `external_id` liés existent : les croiser avec `buildDevice`.
- Une ligne de `status` exige un `value` (nombre ou texte ≤ 40).
- Le cœur **jette un bouton dont la clé d'action est déjà prise** : clés numérotées.
- Le vocabulaire des widgets n'a ni liste ni curseur, **par choix** du cœur. Seul un bouton
  `device_feature` numérique a un état actif natif.
- **En mode sombre, le style `primary` d'un bouton de widget ne se voit pas** (#3153) : signaler
  un choix courant par l'icône (`check-circle`), jamais par le style.
- Dans une grille `card-list`, la `date` s'affiche **à la place** du sous-titre.
- `onWidgetAction` fait recharger le widget dès la résolution, alors que `requestWidgetRefresh`
  est plafonné à un appel toutes les 10 s. Un toast d'action est tronqué à 200 caractères.
- Le cœur met le contenu d'un widget en cache par (réglages, langue, unités) : pré-localiser
  d'après `language` est correct.
- Les filtres de scène ne font qu'égalité et appartenance : un seuil reste le travail d'un capteur.
- **Les clés de widgets, de déclencheurs et d'actions sont figées une fois publiées.**
- `gladys_version` `>=5.1.0` dès qu'il y a widgets, déclencheurs ou actions de scène.

## Store

- Validateur officiel, depuis la racine : `npx -y github:GladysAssistant/integration-store .`
  (schéma, `description` **100 caractères au plus par langue**, documentation de 300 caractères
  au moins, image Docker, cover de **150 Ko au plus**). Il demande Node ≥ 24 mais tourne sous
  Node 22 avec un avertissement.
- L'indexeur lit le manifeste de la **dernière release**, pas celui de `main` : une correction du
  manifeste (catégorie, description…) n'atteint le store qu'avec une release.
- L'indexeur rejette **en silence** : la raison n'apparaît que dans `rejected.json`, à côté de
  `https://integration-store-storage.gladysassistant.com/index.json`.
- **Image de base** : `FROM public.ecr.aws/docker/library/node:…` (miroir officiel ECR Public, même
  empreinte) et non `node:…` de Docker Hub, qui refuse en 429 les pulls anonymes des runners GitHub
  dès qu'il y a plusieurs builds à la fois. Un échec 429 dans le job « Docker build » n'est pas un bug
  du code. Même parade dans `.github/workflows/build.yml` (posée par l'orchestrateur, ne pas la
  retirer) : QEMU et BuildKit tirés de `mirror.gcr.io`.
- La règle `data/` du `.gitignore` du template (pour le volume `/data`) exclut aussi `src/data/` :
  l'ancrer en `/data/`, dans `.prettierignore` aussi.

### Langues (depuis le 11/10/2026)

Tout texte montré à l'utilisateur existe en **`en`, `fr`, `de` et `es`** : manifeste, contenu des widgets, messages,
noms de fonctionnalités. L'allemand **tutoie** (« du »), l'espagnol **vouvoie** (« usted ») : décision de Guilhem,
appliquée à ses 21 intégrations. `test/i18n.test.js` doit échouer sur une langue manquante, un texte vide ou trop
long, et sur un « Sie »/« Ihr… » de politesse en allemand. Le store exige `docs/en.md` et `docs/fr.md`
(`DOCS_LANGUAGES`) et publie aussi `docs/de.md` et `docs/es.md` quand ils existent
(`DOCS_OPTIONAL_LANGUAGES` d'integration-store) : écrire les quatre, avec les mêmes sections.

## Choix par défaut de Guilhem (12/10/2026)

- Langue par défaut des noms de fonctionnalités et des textes produits par le conteneur : **`fr`**.
- Fichier `LICENSE` Apache-2.0 (texte complet) à la racine.
- `transports` : `local` seul quand le cloud n'est qu'une option annexe.
- Docs `en`, `fr`, `de`, `es` avec les mêmes sections.
- Chauffe, ouverture, sécurité : ne rien rendre pilotable « comme un thermostat » ou par un assistant
  vocal quand une erreur serait dangereuse (leçon d'OctoPrint).

## Trafic routier : sources et choix (29/10/2026)

- **Sources vérifiées en direct le 29/10/2026** (Opendatasoft Explore v2.1, sans clé) :
  Rennes `etat-du-trafic-en-temps-reel` (~2 900 tronçons, véhicules traceurs,
  `trafficstatus` freeFlow/heavy/congested/impossible/unknown), Nantes
  `244400404_fluidite-axes-routiers-nantes-metropole` (~890, `etat_trafic` Fluide/Dense/Saturé/
  Bloqué/Indéterminé ; `couleur_tp` n'est pas dans les fixtures), Strasbourg `sirac_flux_trafic`
  (~480 capteurs du SIRAC, `etat` 0-3, `etatexp` 1 = fermé ; les compteurs vélo « Cyc… » écartés),
  Bordeaux `ci_tpstj_a` (16 itinéraires, temps actuel et de référence en secondes, pas d'état :
  niveau calculé par le rapport, seuils 1,3 et 1,8).
- **Écartées** : Lyon (WFS `pvo_patrimoine_voirie.pvotrafic` désormais authentifié), Grenoble
  (`data.mobilites-m.fr/api/dyn/trr/json` donne des niveaux sans nom de tronçon), Paris (comptages
  horaires), Toulouse (archives), Lille, Montpellier, Marseille (rien en temps réel).
- **Requêtes** : le catalogue (noms, positions) par l'export `exports/json` une fois par jour ; à
  chaque cycle, l'export avec `where=<id> in (...)` sur les seuls tronçons des axes ajoutés, par
  paquets de 100. Jamais tout le jeu à chaque cycle (consigne du brief).
- **Axe** = tous les tronçons d'un même nom : Rennes, routes nationales/départementales par nom,
  rues par nom + commune (INSEE → nom en dur dans `sources.js`), « Rond-point » et voies sans nom
  exclus ; Nantes, `cha_lib` sans le code de sens final (`I5`, `P2`) ; Strasbourg, le nom sans le
  numéro de capteur. La clé d'axe dérive du nom : un renommage par la ville crée un nouvel appareil.
- **Niveau d'un axe** : le pire atteint sur au moins 25 % de la longueur mesurée (longueur = vitesse ×
  temps à Rennes, `cha_long` à Nantes, un vote par capteur à Strasbourg). **Pas de temps de parcours
  sur les axes agrégés** (somme de tronçons épars et des deux sens : faux), seulement pour Bordeaux.
  La fiabilité de Rennes n'est pas publiée (un `level-sensor` seul de son type s'afficherait
  « Niveau du liquide »).
- Mesure de plus de 30 min → niveau 0 « Inconnu », rien d'autre publié (la vitesse garde sa dernière
  valeur), l'âge continue de grandir.
- **Autour de la maison** : `getHouses()` (manifeste `location: true`, cœur ≥ 5.2.0), première maison
  localisée, les 40 tronçons les plus proches dans le rayon, calculés dans le conteneur. Au centre de
  Rennes, aucun tronçon à moins de 500 m (rues piétonnes) : 1 km par défaut.
- Déclencheurs : un nouveau niveau ne compte qu'une fois lu deux fois de suite (hystérésis, relecture
  du 29/10). Un catalogue vide est un échec (le connu reste) ; jamais lu, il est retenté après 10 min.
  Un axe disparu du catalogue passe « Inconnu ».
- `gladys_version` `>=5.3.0` pour `countries` et `keywords`.

## Routes nationales (DIR), 1.1 (29/10/2026)

- Source : `https://tipi.bison-fute.gouv.fr/bison-fute-ouvert/publicationsDIR/QTV-DIR/` (HTTPS
  vérifié), sans clé. `refDir.csv` (~1 400 lignes, ~1 000 avec une route) : catalogue, lu une fois
  par jour ; `qtvDir.xml` (DATEX II 2.0, ~1,5 Mo, débit et vitesse par point, toutes les 6 min) :
  lu en flux (`streamText`, analyse bloc par bloc de `<siteMeasurements>`), seuls les points des
  axes ajoutés gardés.
- **Pièges du CSV** : l'en-tête a 20 colonnes, les lignes 19 (`code_insee_commune` sans
  colonne) ; `source_2` finit par le code INSEE de la commune (département = ses 2 premiers
  chiffres) ; ~160 points sans coordonnées ni sens (DIRO : sens 1/2 de `sens_gestionnaire`) ;
  coordonnées en Lambert 93 (conversion IGN dans `sources.js`) ; routes écrites `N0136`.
- **Piège HTTP** : l'ETag d'Apache servi en gzip (`…-gzip`) ne donne jamais 304 ; `If-Modified-Since`
  sur `Last-Modified`, si. Le cache (dernière date, points, mesures) est dans `city.state`, propre à
  chaque instance, pas dans le module.
- **Axe** = route + département + sens (`a620-31-int`) : sens giratoire (intérieur/extérieur), sinon
  cardinal, sinon sens gestionnaire. Nom traduit (`axisNames`, `DIRECTIONS` de `messages.js`), ville
  de la zone `code_traficolor` (TO31 → Toulouse), sinon « (35) ».
- **État** déduit de la vitesse : ≥ 60 fluide, ≥ 30 dense, sinon saturé. **0 km/h = pas de mesure** :
  le 29/10 à 16 h 48, 14 points à 0 km/h avec jusqu'à 27 100 véh/h (boucles en panne). Pondération
  par `longueur` du référentiel. `TRAFICOLOR-DIR/` (fichiers horodatés par région, pas de Toulouse)
  écarté.
