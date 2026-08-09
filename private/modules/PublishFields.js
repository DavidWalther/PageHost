/**
 * Feldnamen rund um die Veröffentlichung — für **beide** Objekt-Generationen.
 *
 * `publish` und `unpublish` sind die einzigen Stellen, die ein
 * Veröffentlichungsdatum sowohl **lesen** als auch **schreiben**. Beides heißt
 * je nach Benennung anders:
 *
 * | Generation                    | gelesen          | geschrieben      |
 * | :---------------------------- | :--------------- | :--------------- |
 * | `story`/`chapter`/`paragraph` | `publishdate`    | `publishDate`    |
 * | `node`/`content`              | `published_date` | `published_date` |
 *
 * Ohne diese Unterscheidung greift die Prüfung „ist schon veröffentlicht?" für
 * die jeweils andere Generation nicht — genau der Defekt, der in der alten
 * Fassung mit `existingRecord.publishDate` (camelCase, gibt es nie) steckte.
 */

/** Spalte, in der das Datum liegt. Gleich für beide Generationen. */
const PUBLISH_COLUMN = 'published_date';

/**
 * Name des Payload-Feldes je Objekt.
 *
 * Ausgeschrieben statt aus `FIELD_MAP` abgeleitet: die Abbildung dort ist
 * case-insensitiv, `publishdate` und `publishDate` landen also ohnehin in
 * derselben Spalte. Hier geht es um die **Schreibweise**, die der Rest des
 * Codes verwendet — und die soll sich nicht danach richten, wie ein
 * Nachschlagewerk zufällig seine Schlüssel schreibt.
 */
const INCOMING_FIELD = {
  story: 'publishDate',
  chapter: 'publishDate',
  paragraph: 'publishDate',
  node: PUBLISH_COLUMN,
  content: PUBLISH_COLUMN,
};

class PublishFields {
  /** Name des Payload-Feldes, über das die Veröffentlichung gesetzt wird. */
  static incomingFieldFor(object) {
    const field = INCOMING_FIELD[String(object).toLowerCase()];
    if (!field) {
      throw new Error(`Object "${object}" has no publish field`);
    }
    return field;
  }

  /**
   * Veröffentlichungsdatum eines **gelesenen** Datensatzes.
   *
   * Die alte Antwortform nennt es `publishdate`, die neue `published_date`.
   * `null` heißt „nicht veröffentlicht" — bei beiden.
   */
  static valueOf(record) {
    if (!record) {
      return null;
    }
    return record.publishdate ?? record[PUBLISH_COLUMN] ?? null;
  }
}

module.exports = { PublishFields, PUBLISH_COLUMN };
