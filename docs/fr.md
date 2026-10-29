# Trafic routier

Le **trafic routier en temps réel** de plusieurs métropoles françaises, lu sur leurs portails open
data : Rennes Métropole, Nantes Métropole, Strasbourg et Bordeaux Métropole. Fluide, dense, saturé
ou coupé, axe par axe, et autour de votre maison. **Sans compte ni clé.**

Intégration non officielle, sans lien avec les métropoles ni leurs centres de gestion du trafic.
Les sources ont été vérifiées en direct le 29/10/2026 ; les retours des utilisateurs de chaque
ville sont les bienvenus.

## Ce que vous obtenez

- Un **appareil par axe** suivi : niveau de trafic et son nom (fluide, dense, saturé, coupé),
  vitesse moyenne (Rennes, Nantes, Strasbourg) ou temps de parcours et sa valeur habituelle
  (Bordeaux), et l'âge de la mesure.
- Un **appareil « Autour de la maison »** par ville : les tronçons situés à la distance choisie de
  la maison localisée dans Gladys, réunis en un seul niveau.
- Un **widget** « Trafic routier » : vos axes sur une ligne chacun, en vert, orange ou rouge.
- Deux **déclencheurs de scène** : un axe devient dense ou saturé, un axe redevient fluide.
- Une **action de scène** : le trafic sur vos axes en une phrase, prête à envoyer ou à dire.

## Prérequis

- Gladys Assistant **5.3.0** ou plus récent.
- Un accès Internet depuis Gladys : les données viennent des portails open data.
- Ni compte, ni clé d'API. Pour l'appareil « Autour de la maison », une maison localisée dans
  Gladys (Paramètres → Maisons) : l'intégration demande l'accès à sa position à l'installation.

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub**.
2. Collez l'adresse `https://github.com/guim31/gladys-trafic` et validez.
3. Ouvrez l'intégration une fois installée : l'onglet **Configuration** s'affiche.

## Configuration

### Réglages

| Réglage                     | Effet                                                                        |
| --------------------------- | ---------------------------------------------------------------------------- |
| Villes                      | les métropoles dont les axes sont proposés dans l'onglet Découverte          |
| Axes à suivre               | une partie du nom de vos axes, séparée par des virgules (3 lettres au moins) |
| Autour de la maison         | désactivé, 500 m, 1 km (par défaut), 2 km ou 3 km autour de la maison        |
| Rafraîchissement            | toutes les 2, 3 (par défaut) ou 5 minutes                                    |
| Langue des noms et messages | langue des fonctionnalités, du widget et des phrases de scène (français)     |

Les noms des fonctionnalités sont figés à l'ajout de l'appareil : choisissez la langue d'abord.

### Ajouter des axes

1. Cochez une ou plusieurs villes et tapez les axes que vous empruntez, par exemple
   `Route nationale 136, Patton, Schirmeck`. Majuscules et accents sont indifférents. Enregistrez.
2. Ouvrez l'onglet **Découverte** : les axes correspondants apparaissent sous la forme « Ville ·
   Axe » (50 par ville au plus), avec « Ville · Autour de la maison » quand des tronçons se trouvent
   à la distance choisie. Pour Bordeaux, les 16 itinéraires sont toujours proposés.
3. Ajoutez ceux qui vous intéressent à Gladys. Leurs valeurs arrivent aussitôt.

Les axes ajoutés sont les **axes suivis** : le widget, les déclencheurs et l'action de scène les
proposent. Un axe ajouté reste lu même si vous changez la recherche ensuite.

Un « axe » réunit tous les tronçons du portail qui portent ce nom : à Rennes, une route nationale
ou départementale d'une commune à l'autre, une rue dans sa commune (la commune est dans le nom) ; à
Nantes, les deux sens d'un boulevard ; à Strasbourg, un point de mesure du centre de gestion du
trafic.

### Vérifier

L'action **État** de l'onglet Configuration liste les villes lues, le nombre d'axes connus,
l'heure de la dernière lecture, la dernière erreur s'il y en a une, les tronçons autour de la
maison et le nombre d'axes ajoutés.

## Appareils

Chaque axe ajouté est un appareil en lecture seule :

| Fonctionnalité             | Type Gladys      | Valeur                                             |
| -------------------------- | ---------------- | -------------------------------------------------- |
| Trafic                     | texte            | Fluide, Dense, Saturé, Coupé ou Inconnu            |
| Niveau de trafic           | niveau de risque | 0 inconnu, 1 fluide, 2 dense, 3 saturé, 4 coupé    |
| Vitesse moyenne            | vitesse (km/h)   | Rennes, Nantes, Strasbourg                         |
| Temps de parcours          | durée (minutes)  | Bordeaux : temps de parcours de l'itinéraire       |
| Temps de parcours habituel | durée (minutes)  | Bordeaux : la valeur de référence publiée avec lui |
| Âge de la donnée           | durée (minutes)  | âge de la mesure la plus récente                   |

Le **niveau d'un axe** est le pire niveau atteint sur **au moins un quart de sa longueur** (chaque
tronçon compte une fois à Strasbourg, qui ne publie pas les longueurs) : un carrefour bouché ne
rend pas toute la rocade saturée. La **vitesse moyenne** est la longueur de l'axe divisée par son
temps de parcours.

Sans aucune mesure de **moins de 30 minutes**, l'axe est **Inconnu** (niveau 0) : aucune valeur
n'est inventée, la vitesse garde sa dernière valeur connue et l'âge de la donnée continue de
grandir.

## Widget du tableau de bord

Ajoutez le widget **Trafic routier** à un tableau de bord. Il affiche une ligne par axe suivi (dix
au plus), avec le nom donné dans Gladys, par exemple « Rocade — Dense · 42 km/h ». Dans les
réglages du widget, vous pouvez choisir les axes affichés (vide : tous) et masquer la vitesse ou le
temps de parcours.

Couleurs : **vert** fluide, **orange** dense, **rouge** saturé ou coupé, **gris** inconnu.

## Déclencheurs de scène

| Déclencheur         | Se produit quand                                         |
| ------------------- | -------------------------------------------------------- |
| Bouchon sur un axe  | un axe suivi atteint le niveau choisi : dense, ou saturé |
| Axe redevenu fluide | un axe suivi qui était dense ou saturé redevient fluide  |

Le champ **Axes** filtre les axes concernés ; vide, n'importe quel axe suivi. Les variables
disponibles pour les actions suivantes : axe, ville, trafic (le niveau en toutes lettres), vitesse
moyenne.

Les déclencheurs comparent deux niveaux connus successifs de l'axe : rien ne se déclenche au retour
d'un portail après une longue panne, ni tant que l'axe est inconnu.

## Action de scène

**État du trafic en une phrase** : l'état de vos axes suivis (ou de ceux choisis). Résultats :

- `sentence` : « Trafic : Rocade (dense, 42 km/h). Fluide ailleurs. », ou « Trafic fluide sur vos
  3 axes suivis. » ;
- `worst_level` : le pire niveau, de 0 à 4 (à tester avec « Continuer seulement si ») ;
- `jammed` : le nombre d'axes denses ou pire.

La phrase suit la langue choisie dans la configuration.

## Exemples de scènes

- **Avant de partir au travail** : à 7 h 30 en semaine, action « État du trafic en une phrase »,
  puis « Envoyer un message » avec `sentence`, ou la dire sur une enceinte.
- **Rocade bouchée** : déclencheur « Bouchon sur un axe » (rocade, saturé), puis une notification
  « Partez plus tôt ou prenez le train ».
- **La route est dégagée** : déclencheur « Axe redevenu fluide » sur le trajet du retour, puis un
  message.

## Données et rafraîchissement

| Ville      | Portail et jeu de données                                           | Mise à jour par la ville | Tronçons       |
| ---------- | ------------------------------------------------------------------- | ------------------------ | -------------- |
| Rennes     | data.rennesmetropole.fr, « État du trafic en temps réel »           | toutes les quelques min  | ~2 900         |
| Nantes     | data.nantesmetropole.fr, « Fluidité des axes routiers »             | toutes les quelques min  | ~890           |
| Strasbourg | data.strasbourg.eu, « SIRAC - flux trafic en temps réel »           | toutes les 3 minutes     | ~480           |
| Bordeaux   | opendata.bordeaux-metropole.fr, « Temps de parcours en temps réel » | toutes les 2 min 30      | 16 itinéraires |

La liste des tronçons (noms, positions) est lue **une fois par jour** par ville. À chaque
rafraîchissement, une requête par ville lit **seulement les tronçons des axes ajoutés**, filtrés
par le portail lui-même (une requête de plus par centaine de tronçons) : quelques kilo-octets,
environ 500 requêtes par jour et par ville à 3 minutes, bien dans l'usage anonyme des portails
Opendatasoft. Seules les villes cochées et celles des axes ajoutés sont lues.

Bordeaux ne publie pas d'état : le niveau est calculé à partir du temps de parcours comparé à sa
valeur habituelle (jusqu'à 1,3 fois : fluide, jusqu'à 1,8 fois : dense, au-delà : saturé). Les
tronçons « bloqués » de Nantes comptent comme saturés. Les compteurs vélo de Strasbourg sont
écartés.

## Dépannage

- **Aucun axe dans Découverte** : vérifiez qu'une ville est cochée et un axe tapé (3 lettres au
  moins), puis lancez l'action **État**. Une erreur « HTTP 503 » ou « timeout » vient du portail :
  réessayez plus tard.
- **Pas d'appareil « Autour de la maison »** : la maison n'a pas de position dans Gladys, ou aucun
  tronçon ne se trouve à la distance choisie : essayez-en une plus grande. L'action État dit
  combien de tronçons ont été trouvés.
- **Niveau « Inconnu »** : le portail n'a publié aucune mesure pour cet axe depuis plus de 30
  minutes (la nuit, certains tronçons ne sont pas mesurés).
- Pour plus de détails, mettez `LOG_LEVEL=debug` : chaque lecture est alors journalisée.

## Limites

- Seules les villes listées sont prises en charge. **Lyon** demande désormais un compte pour son
  flux de trafic, **Grenoble** publie des niveaux sans le nom des tronçons, **Paris** et
  **Toulouse** ne publient que des comptages horaires ou archivés : ces villes pourront être
  ajoutées si leurs données le permettent.
- Les axes sont les tronçons et les noms des portails : un axe renommé par la ville devient un
  nouvel appareil.
- Les niveaux sont ceux des villes (véhicules traceurs à Rennes, capteurs ailleurs) : ils peuvent
  différer d'une application de navigation.
- Lecture seule. Sans lien avec les métropoles.

## Crédits

- Données : Rennes Métropole, Nantes Métropole, Eurométropole de Strasbourg (SIRAC), Bordeaux
  Métropole, sous leurs licences ouvertes respectives (Licence Ouverte / ODbL). Noms des communes :
  geo.api.gouv.fr.
- Construite à partir du
  [modèle d'intégration](https://github.com/GladysAssistant/integration-template-js) officiel.
