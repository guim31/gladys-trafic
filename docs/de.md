# Straßenverkehr

Der **Straßenverkehr in Echtzeit** mehrerer französischer Großstädte, gelesen aus ihren Open-Data-
Portalen: Rennes Métropole, Nantes Métropole, Straßburg und Bordeaux Métropole. Flüssig, dicht,
Stau oder gesperrt, Straße für Straße und rund um dein Haus. **Kein Konto, kein Schlüssel.**

Inoffizielle Integration, ohne Verbindung zu den Städten oder ihren Verkehrszentralen. Die Quellen
wurden am 29.10.2026 live geprüft; Rückmeldungen aus jeder Stadt sind willkommen.

## Was du bekommst

- Ein **Gerät pro Straße**, der du folgst: Verkehrsstufe und ihr Name (flüssig, dicht, Stau,
  gesperrt), Durchschnittsgeschwindigkeit (Rennes, Nantes, Straßburg) oder Fahrzeit und ihr
  üblicher Wert (Bordeaux) sowie das Alter der Messung.
- Ein **Gerät „Rund ums Haus“** pro Stadt: die Straßenabschnitte im gewählten Umkreis des in Gladys
  verorteten Hauses, zu einer einzigen Stufe zusammengefasst.
- Ein **Widget** „Straßenverkehr“: deine Straßen je in einer Zeile, grün, orange oder rot.
- Zwei **Szenen-Auslöser**: eine Straße wird dicht oder staut sich, eine Straße ist wieder frei.
- Eine **Szenen-Aktion**: der Verkehr auf deinen Straßen in einem Satz, fertig zum Senden oder
  Vorlesen.

## Voraussetzungen

- Gladys Assistant **5.3.0** oder neuer.
- Internetzugang für Gladys: die Daten kommen von den Open-Data-Portalen.
- Kein Konto, kein API-Schlüssel. Für das Gerät „Rund ums Haus“ ein in Gladys verortetes Haus
  (Einstellungen → Häuser): die Integration bittet bei der Installation um Zugriff auf seinen
  Standort.

## Installation

1. Öffne in Gladys **Integrationen → Von GitHub installieren**.
2. Füge die Adresse `https://github.com/guim31/gladys-trafic` ein und bestätige.
3. Öffne die Integration nach der Installation: der Tab **Konfiguration** erscheint.

## Konfiguration

### Einstellungen

| Einstellung                       | Wirkung                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Städte                            | die Großstädte, deren Straßen im Tab „Entdecken“ angeboten werden             |
| Zu überwachende Straßen           | ein Teil der Namen deiner Straßen, durch Kommas getrennt (mind. 3 Buchstaben) |
| Rund ums Haus                     | aus, 500 m, 1 km (Standard), 2 km oder 3 km um das Haus                       |
| Aktualisierung                    | alle 2, 3 (Standard) oder 5 Minuten                                           |
| Sprache der Namen und Nachrichten | Sprache der Funktionsnamen, des Widgets und der Szenensätze (Französisch)     |

Die Namen der Funktionen werden beim Hinzufügen festgelegt: wähle zuerst die Sprache.

### Straßen hinzufügen

1. Kreuze eine oder mehrere Städte an und gib die Straßen ein, die du fährst, zum Beispiel
   `Route nationale 136, Patton, Schirmeck`. Groß- und Kleinschreibung sowie Akzente spielen keine
   Rolle. Speichere.
2. Öffne den Tab **Entdecken**: die passenden Straßen erscheinen als „Stadt · Straße“ (höchstens
   50 pro Stadt), dazu „Stadt · Rund ums Haus“, wenn Abschnitte im gewählten Umkreis liegen. Für
   Bordeaux werden die 16 Strecken immer angeboten.
3. Füge die gewünschten zu Gladys hinzu. Die Werte kommen sofort.

Die hinzugefügten Straßen sind die **überwachten Straßen**: das Widget, die Auslöser und die
Szenen-Aktion bieten sie an. Eine hinzugefügte Straße wird weiter gelesen, auch wenn du die Suche
danach änderst.

Eine „Straße“ fasst alle Abschnitte des Portals mit diesem Namen zusammen: in Rennes eine National-
oder Departementsstraße über Gemeinden hinweg, eine Straße innerhalb ihrer Gemeinde (die Gemeinde
steht im Namen); in Nantes beide Richtungen eines Boulevards; in Straßburg die nummerierten Sensoren eines Orts der Verkehrszentrale.

### Prüfen

Die Aktion **Status** im Tab Konfiguration listet die gelesenen Städte, die Zahl der bekannten
Straßen, die Zeit der letzten Abfrage, den letzten Fehler, die Abschnitte rund ums Haus und die
Zahl der hinzugefügten Straßen.

## Geräte

Jede hinzugefügte Straße ist ein schreibgeschütztes Gerät:

| Funktion                     | Gladys-Typ             | Wert                                                |
| ---------------------------- | ---------------------- | --------------------------------------------------- |
| Verkehr                      | Text                   | Flüssig, Dicht, Stau, Gesperrt oder Unbekannt       |
| Verkehrsstufe                | Risikostufe            | 0 unbekannt, 1 flüssig, 2 dicht, 3 Stau, 4 gesperrt |
| Durchschnittsgeschwindigkeit | Geschwindigkeit (km/h) | Rennes, Nantes, Straßburg                           |
| Fahrzeit                     | Dauer (Minuten)        | Bordeaux: Fahrzeit der Strecke                      |
| Übliche Fahrzeit             | Dauer (Minuten)        | Bordeaux: der mit ihr veröffentlichte Referenzwert  |
| Alter der Daten              | Dauer (Minuten)        | Alter der neuesten Messung                          |

Die **Stufe einer Straße** ist die schlechteste Stufe, die auf **mindestens einem Viertel ihrer
Länge** erreicht wird (in Straßburg, das keine Längen veröffentlicht, zählt jeder Abschnitt
einmal): eine verstopfte Kreuzung macht nicht die ganze Ringstraße zum Stau. Die
**Durchschnittsgeschwindigkeit** ist die Länge der Straße geteilt durch ihre Fahrzeit.

Ohne eine Messung, die **jünger als 30 Minuten** ist, ist die Straße **Unbekannt** (Stufe 0): kein
Wert wird erfunden, die Geschwindigkeit behält ihren letzten bekannten Wert und das Alter der Daten
wächst weiter.

## Dashboard-Widget

Füge das Widget **Straßenverkehr** einem Dashboard hinzu. Es zeigt eine Zeile pro überwachter
Straße (höchstens zehn) mit dem in Gladys vergebenen Namen, zum Beispiel „Rocade — Dicht · 42
km/h“. In den Widget-Einstellungen kannst du die angezeigten Straßen wählen (leer: alle) und die
Geschwindigkeit oder die Fahrzeit ausblenden.

Farben: **grün** flüssig, **orange** dicht, **rot** Stau oder gesperrt, **grau** unbekannt.

## Szenen-Auslöser

| Auslöser              | Tritt ein, wenn                                                        |
| --------------------- | ---------------------------------------------------------------------- |
| Stau auf einer Straße | eine überwachte Straße die gewählte Stufe erreicht: dicht oder Stau    |
| Straße wieder frei    | eine überwachte Straße, die dicht oder gestaut war, wieder flüssig ist |

Das Feld **Straßen** filtert die betroffenen Straßen; leer: jede überwachte Straße. Die Variablen
für die folgenden Aktionen: Straße, Stadt, Verkehr (die Stufe als Wort),
Durchschnittsgeschwindigkeit.

Eine neue Stufe zählt erst, wenn sie **zweimal hintereinander** gelesen wurde (eine Aktualisierung mehr): eine Straße, die um eine Schwelle pendelt, löst nicht bei jedem Zyklus aus. Die Auslöser vergleichen zwei aufeinanderfolgende bekannte Stufen der Straße: nichts wird
ausgelöst, wenn ein Portal nach einem langen Ausfall zurückkommt, und nichts, solange die Straße
unbekannt ist.

## Szenen-Aktion

**Verkehrslage in einem Satz**: der Zustand deiner überwachten Straßen (oder der gewählten).
Ergebnisse:

- `sentence`: „Verkehr: Rocade (dicht, 42 km/h). Sonst flüssig.“, oder „Der Verkehr fließt auf
  deinen 3 überwachten Straßen.“;
- `worst_level`: die schlechteste Stufe, 0 bis 4 (zum Prüfen mit „Nur fortfahren, wenn“);
- `jammed`: die Zahl der Straßen, die dicht oder schlechter sind.

Der Satz folgt der in der Konfiguration gewählten Sprache.

## Szenenbeispiele

- **Vor der Fahrt zur Arbeit**: werktags um 7:30 die Aktion „Verkehrslage in einem Satz“, dann
  „Nachricht senden“ mit `sentence`, oder auf einem Lautsprecher vorlesen.
- **Ringstraße verstopft**: Auslöser „Stau auf einer Straße“ (Ringstraße, Stau), dann eine
  Benachrichtigung „Fahr früher los oder nimm den Zug“.
- **Die Straße ist frei**: Auslöser „Straße wieder frei“ auf dem Heimweg, dann eine Nachricht.

## Daten und Aktualisierung

| Stadt     | Portal und Datensatz                                              | Von der Stadt aktualisiert | Abschnitte  |
| --------- | ----------------------------------------------------------------- | -------------------------- | ----------- |
| Rennes    | data.rennesmetropole.fr, „État du trafic en temps réel“           | alle paar Minuten          | ~2.900      |
| Nantes    | data.nantesmetropole.fr, „Fluidité des axes routiers“             | alle paar Minuten          | ~890        |
| Straßburg | data.strasbourg.eu, „SIRAC - flux trafic en temps réel“           | alle 3 Minuten             | ~480        |
| Bordeaux  | opendata.bordeaux-metropole.fr, „Temps de parcours en temps réel“ | alle 2,5 Minuten           | 16 Strecken |

Die Liste der Abschnitte (Namen, Positionen) wird **einmal am Tag** pro Stadt gelesen. Bei jeder
Aktualisierung liest eine Anfrage pro Stadt **nur die Abschnitte der hinzugefügten Straßen**,
vom Portal selbst gefiltert (eine Anfrage mehr pro hundert Abschnitte): ein paar Kilobyte, etwa
500 Anfragen am Tag pro Stadt bei 3 Minuten, gut innerhalb der anonymen Nutzung der
Opendatasoft-Portale. Gelesen werden nur die angekreuzten Städte und die der hinzugefügten
Straßen.

Bordeaux veröffentlicht keinen Zustand: die Stufe wird aus der Fahrzeit im Vergleich zu ihrem
üblichen Wert berechnet (bis 1,3-fach: flüssig, bis 1,8-fach: dicht, darüber: Stau). Die
„blockierten“ Abschnitte von Nantes zählen als Stau. Die Fahrradzähler von Straßburg werden
ausgelassen.

## Fehlerbehebung

- **Keine Straße in „Entdecken“**: prüfe, ob eine Stadt angekreuzt und eine Straße eingegeben ist
  (mindestens 3 Buchstaben), und starte die Aktion **Status**. Ein Fehler „HTTP 503“ oder
  „timeout“ kommt vom Portal: versuch es später erneut.
- **Kein Gerät „Rund ums Haus“**: das Haus hat in Gladys keinen Standort, oder kein Abschnitt liegt
  im gewählten Umkreis: versuch einen größeren. Die Aktion Status sagt, wie viele Abschnitte
  gefunden wurden.
- **Stufe „Unbekannt“**: das Portal hat seit mehr als 30 Minuten keine Messung für diese Straße
  veröffentlicht (nachts werden manche Abschnitte nicht gemessen).
- Für mehr Details setze `LOG_LEVEL=debug`: jede Abfrage wird dann protokolliert.

## Einschränkungen

- Nur die aufgeführten Städte werden unterstützt. **Lyon** verlangt jetzt ein Konto für seinen
  Verkehrsfeed, **Grenoble** veröffentlicht Stufen ohne die Namen der Abschnitte, **Paris** und
  **Toulouse** veröffentlichen nur stündliche oder archivierte Zählungen: diese Städte können
  hinzugefügt werden, wenn ihre Daten es erlauben.
- Die Straßen sind die Abschnitte und Namen der Portale: eine von der Stadt umbenannte Straße wird
  ein neues Gerät.
- Die Stufen sind die der Städte (Floating Car Data in Rennes, Sensoren anderswo): sie können von
  einer Navigations-App abweichen.
- Nur lesend. Ohne Verbindung zu den Großstädten.

## Danksagung

- Daten: Rennes Métropole, Nantes Métropole, Eurométropole de Strasbourg (SIRAC), Bordeaux
  Métropole, unter ihren jeweiligen offenen Lizenzen (Licence Ouverte / ODbL). Gemeindenamen:
  geo.api.gouv.fr.
- Erstellt aus der offiziellen
  [Integrationsvorlage](https://github.com/GladysAssistant/integration-template-js).
