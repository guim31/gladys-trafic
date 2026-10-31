// -----------------------------------------------------------------------------
// Texts sent from the container (feature names, action messages, widget
// contents, scene outputs), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted". Road and place names never translate.
// -----------------------------------------------------------------------------

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// The Grand Lyon data account (Lyon only): the connection status of the
// integration and the "Status" action. The data portal has its own password,
// not the GrandLyon Connect one.
export const CREDENTIALS = {
  en: {
    missing:
      'Lyon: enter the username and password of your Grand Lyon data account (data.grandlyon.com) in the settings. The other cities keep working.',
    refused:
      'Lyon: Grand Lyon credentials refused. Check the username and password of your data.grandlyon.com account (not GrandLyon Connect). The other cities keep working.',
  },
  fr: {
    missing:
      "Lyon : saisissez l'identifiant et le mot de passe de votre compte data Grand Lyon (data.grandlyon.com) dans les réglages. Les autres villes continuent de fonctionner.",
    refused:
      "Lyon : identifiants Grand Lyon refusés. Vérifiez l'identifiant et le mot de passe de votre compte data.grandlyon.com (distinct de GrandLyon Connect). Les autres villes continuent de fonctionner.",
  },
  de: {
    missing:
      'Lyon: Gib in den Einstellungen Benutzername und Passwort deines Grand-Lyon-Datenkontos (data.grandlyon.com) ein. Die anderen Städte funktionieren weiter.',
    refused:
      'Lyon: Grand-Lyon-Zugangsdaten abgelehnt. Prüfe Benutzername und Passwort deines Kontos auf data.grandlyon.com (nicht GrandLyon Connect). Die anderen Städte funktionieren weiter.',
  },
  es: {
    missing:
      'Lyon: introduzca el usuario y la contraseña de su cuenta de datos Grand Lyon (data.grandlyon.com) en los ajustes. Las demás ciudades siguen funcionando.',
    refused:
      'Lyon: credenciales de Grand Lyon rechazadas. Compruebe el usuario y la contraseña de su cuenta de data.grandlyon.com (no GrandLyon Connect). Las demás ciudades siguen funcionando.',
  },
};

// Feature names, frozen when the device is created (configured language),
// and the name of the "around the house" device.
export const NAMES = {
  en: {
    status: 'Traffic',
    level: 'Traffic level',
    speed: 'Average speed',
    travel_time: 'Travel time',
    usual_time: 'Usual travel time',
    age: 'Data age',
    home: 'Around the house',
  },
  fr: {
    status: 'Trafic',
    level: 'Niveau de trafic',
    speed: 'Vitesse moyenne',
    travel_time: 'Temps de parcours',
    usual_time: 'Temps de parcours habituel',
    age: 'Âge de la donnée',
    home: 'Autour de la maison',
  },
  de: {
    status: 'Verkehr',
    level: 'Verkehrsstufe',
    speed: 'Durchschnittsgeschwindigkeit',
    travel_time: 'Fahrzeit',
    usual_time: 'Übliche Fahrzeit',
    age: 'Alter der Daten',
    home: 'Rund ums Haus',
  },
  es: {
    status: 'Tráfico',
    level: 'Nivel de tráfico',
    speed: 'Velocidad media',
    travel_time: 'Tiempo de recorrido',
    usual_time: 'Tiempo de recorrido habitual',
    age: 'Antigüedad del dato',
    home: 'Alrededor de la casa',
  },
};

// The directions of the national roads (src/sources.js, dirDirection), part
// of the device names: frozen when the device is created.
export const DIRECTIONS = {
  en: {
    int: 'inner ring',
    ext: 'outer ring',
    'n-s': 'southbound',
    's-n': 'northbound',
    'e-w': 'westbound',
    'w-e': 'eastbound',
    s1: 'direction 1',
    s2: 'direction 2',
  },
  fr: {
    int: 'intérieur',
    ext: 'extérieur',
    'n-s': 'vers le sud',
    's-n': 'vers le nord',
    'e-w': "vers l'ouest",
    'w-e': "vers l'est",
    s1: 'sens 1',
    s2: 'sens 2',
  },
  de: {
    int: 'Innenring',
    ext: 'Außenring',
    'n-s': 'Richtung Süden',
    's-n': 'Richtung Norden',
    'e-w': 'Richtung Westen',
    'w-e': 'Richtung Osten',
    s1: 'Richtung 1',
    s2: 'Richtung 2',
  },
  es: {
    int: 'anillo interior',
    ext: 'anillo exterior',
    'n-s': 'hacia el sur',
    's-n': 'hacia el norte',
    'e-w': 'hacia el oeste',
    'w-e': 'hacia el este',
    s1: 'sentido 1',
    s2: 'sentido 2',
  },
};

// The traffic levels, by STATUS code: 0 unknown … 4 closed.
export const LEVELS = {
  en: ['unknown', 'free flow', 'heavy', 'congested', 'closed'],
  fr: ['inconnu', 'fluide', 'dense', 'saturé', 'coupé'],
  de: ['unbekannt', 'flüssig', 'dicht', 'Stau', 'gesperrt'],
  es: ['desconocido', 'fluido', 'denso', 'saturado', 'cortado'],
};

/** "Fluide" from 1: the level as a capitalized word. */
export function levelName(level, language) {
  const word = (LEVELS[language] ?? LEVELS.en)[level] ?? LEVELS.en[0];
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const plural = (count, one, many) => (count === 1 ? one : many);
const pluralFr = (count, one, many) => (count > 1 ? many : one);

// Widget contents and scene outputs.
export const TEXT = {
  en: {
    minutes: ({ minutes }) => `${minutes} min`,
    allFree: ({ count }) =>
      `Traffic is flowing freely on your ${count} watched ${plural(count, 'road', 'roads')}.`,
    noData: 'No recent traffic measure for your watched roads.',
    elsewhere: 'Free flow elsewhere.',
    pickAxis: 'Add a road in the Discover tab of the integration, then pick it here.',
    gone: 'This road is no longer watched.',
    noAxis: 'No road is watched: add one in the Discover tab of the integration.',
  },
  fr: {
    minutes: ({ minutes }) => `${minutes} min`,
    allFree: ({ count }) =>
      `Trafic fluide sur ${pluralFr(count, 'votre axe suivi', `vos ${count} axes suivis`)}.`,
    noData: 'Pas de mesure récente du trafic sur vos axes suivis.',
    elsewhere: 'Fluide ailleurs.',
    pickAxis: "Ajoutez un axe dans l'onglet Découverte de l'intégration, puis choisissez-le ici.",
    gone: "Cet axe n'est plus suivi.",
    noAxis: "Aucun axe n'est suivi : ajoutez-en un dans l'onglet Découverte de l'intégration.",
  },
  de: {
    minutes: ({ minutes }) => `${minutes} Min.`,
    allFree: ({ count }) =>
      `Der Verkehr fließt auf ${plural(count, 'deiner überwachten Straße', `deinen ${count} überwachten Straßen`)}.`,
    noData: 'Keine aktuelle Verkehrsmessung für deine überwachten Straßen.',
    elsewhere: 'Sonst flüssig.',
    pickAxis: 'Füge eine Straße im Tab „Entdecken“ der Integration hinzu und wähle sie hier.',
    gone: 'Diese Straße wird nicht mehr überwacht.',
    noAxis: 'Keine Straße wird überwacht: füge eine im Tab „Entdecken“ der Integration hinzu.',
  },
  es: {
    minutes: ({ minutes }) => `${minutes} min`,
    allFree: ({ count }) =>
      `Tráfico fluido en ${plural(count, 'su vía vigilada', `sus ${count} vías vigiladas`)}.`,
    noData: 'No hay medida reciente del tráfico en sus vías vigiladas.',
    elsewhere: 'Fluido en el resto.',
    pickAxis: 'Añada una vía en la pestaña Descubrir de la integración y luego elíjala aquí.',
    gone: 'Esta vía ya no está vigilada.',
    noAxis: 'No se vigila ninguna vía: añada una en la pestaña Descubrir de la integración.',
  },
};

// Answer of the "Status" configuration action.
export const REPORTS = {
  en: {
    noCity: 'No city chosen: tick one or more cities above, then save.',
    city: ({ name, count }) => `■ ${name}: ${count} road${count === 1 ? '' : 's'} known`,
    read: ({ age }) => `Last reading ${age} s ago.`,
    waiting: 'Not read yet.',
    error: ({ error }) => `Last error: ${error}`,
    home: ({ count }) => `Around the house: ${count} segment${count === 1 ? '' : 's'}.`,
    noHouse: 'Around the house: no located house in Gladys.',
    tooMany: ({ count, max }) =>
      `${count} roads match the search, only the first ${max} are offered: make it more precise.`,
    watched: ({ count }) => `${count} road${count === 1 ? '' : 's'} added to Gladys.`,
  },
  fr: {
    noCity: 'Aucune ville choisie : cochez une ou plusieurs villes ci-dessus, puis enregistrez.',
    city: ({ name, count }) =>
      `■ ${name} : ${count} axe${count > 1 ? 's' : ''} connu${count > 1 ? 's' : ''}`,
    read: ({ age }) => `Dernière lecture il y a ${age} s.`,
    waiting: 'Pas encore lu.',
    error: ({ error }) => `Dernière erreur : ${error}`,
    home: ({ count }) => `Autour de la maison : ${count} tronçon${count > 1 ? 's' : ''}.`,
    noHouse: 'Autour de la maison : aucune maison localisée dans Gladys.',
    tooMany: ({ count, max }) =>
      `${count} axes correspondent à la recherche, seuls les ${max} premiers sont proposés : précisez-la.`,
    watched: ({ count }) =>
      `${count} axe${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} à Gladys.`,
  },
  de: {
    noCity: 'Keine Stadt gewählt: kreuze oben eine oder mehrere Städte an und speichere.',
    city: ({ name, count }) => `■ ${name}: ${count} ${count === 1 ? 'Straße' : 'Straßen'} bekannt`,
    read: ({ age }) => `Letzte Abfrage vor ${age} s.`,
    waiting: 'Noch nicht abgefragt.',
    error: ({ error }) => `Letzter Fehler: ${error}`,
    home: ({ count }) => `Rund ums Haus: ${count} ${count === 1 ? 'Abschnitt' : 'Abschnitte'}.`,
    noHouse: 'Rund ums Haus: kein Haus mit Standort in Gladys.',
    tooMany: ({ count, max }) =>
      `${count} Straßen passen zur Suche, nur die ersten ${max} werden angeboten: mach sie genauer.`,
    watched: ({ count }) => `${count} ${count === 1 ? 'Straße' : 'Straßen'} zu Gladys hinzugefügt.`,
  },
  es: {
    noCity: 'Ninguna ciudad elegida: marque una o varias ciudades arriba y guarde.',
    city: ({ name, count }) =>
      `■ ${name}: ${count} vía${count === 1 ? '' : 's'} conocida${count === 1 ? '' : 's'}`,
    read: ({ age }) => `Última lectura hace ${age} s.`,
    waiting: 'Aún no leído.',
    error: ({ error }) => `Último error: ${error}`,
    home: ({ count }) => `Alrededor de la casa: ${count} tramo${count === 1 ? '' : 's'}.`,
    noHouse: 'Alrededor de la casa: ninguna casa localizada en Gladys.',
    tooMany: ({ count, max }) =>
      `${count} vías coinciden con la búsqueda, solo se ofrecen las ${max} primeras: precísela.`,
    watched: ({ count }) =>
      `${count} vía${count === 1 ? '' : 's'} añadida${count === 1 ? '' : 's'} a Gladys.`,
  },
};

/** One text of a table, in a language (English when missing). */
export function say(table, language, key, params = {}) {
  const entry = table[language]?.[key] ?? table.en[key];
  return typeof entry === 'function' ? entry(params) : entry;
}

/** The same text in every language of the table: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    Object.keys(table).map((language) => [language, say(table, language, key, params)]),
  );
}

/** Joins rendered messages (or plain strings), language by language, one per line. */
export function lines(...messages) {
  const languages = Object.keys(messages.find((m) => typeof m === 'object' && m) ?? { en: '' });
  return Object.fromEntries(
    languages.map((language) => [
      language,
      messages
        .filter((message) => message !== null && message !== undefined)
        .map((message) => (typeof message === 'string' ? message : message[language]))
        .join('\n'),
    ]),
  );
}
