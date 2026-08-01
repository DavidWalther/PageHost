/**
 * Schnittstelle für die Inhaltsquelle des Lesepfads.
 *
 * Zweck: die Umstellung vom alten Datenmodell (`story`/`chapter`/`paragraph`)
 * auf das neue (`node`/`content_node`/`content_item`) so vorzubereiten, dass
 * **dieselben** Charakterisierungstests gegen beide Quellen laufen können.
 * Solange sie für beide grün sind, ist der Wechsel von außen nicht beobachtbar.
 *
 * Bewusst KEIN Laufzeitschalter, keine Factory, keine Env-Variable: es gibt
 * genau einen Umschaltpunkt, und der ist eine Zeile in der `DataFacade`. Die
 * alte Implementierung verschwindet danach.
 *
 * Abgrenzung:
 * - **Caching gehört nicht hierher.** Ein Repository liefert immer aus der
 *   Datenbank; ob vorher in Redis geschaut wird, entscheidet die `DataFacade`.
 * - **`configuration` und `identity` gehören nicht hierher.** Beide sind von
 *   der Umstellung nicht betroffen und laufen weiter direkt über `DataStorage`.
 *
 * Der App-Schlüssel kommt als Parameter (`setApplicationKey`) und wird nicht
 * selbst aus der Umgebung gelesen. Das Datenmodell trägt über `app_node` schon
 * mehrere Apps in einer Datenbank; was mehrere Apps pro Serverinstanz heute
 * blockiert, ist allein die prozessweite Herkunft des Schlüssels. Hier kostet
 * es nichts, das nicht zu verbauen.
 */
class ContentRepository {
  constructor(environment) {
    if (!environment) {
      throw new Error('Environment object is required');
    }
    this.environment = environment;
  }

  setApplicationKey(applicationKey) {
    this.applicationKey = applicationKey;
    return this;
  }

  /**
   * Publish-Filter. Drei Zustände, die auseinandergehalten werden müssen:
   *
   *   nicht gesetzt (undefined) -> Standardfilter der jeweiligen Quelle
   *   null                      -> gar kein Filter (edit-Scope)
   *   Datum                     -> Filter gegen genau dieses Datum
   */
  setPublishDate(publishDate) {
    this.publishDate = publishDate;
    return this;
  }

  /** Story mit ihren Kapitel-Kopfdaten unter `chapters[]`. */
  async getStory() {
    throw new Error('ContentRepository.getStory is not implemented');
  }

  /** Kapitel mit den Kopfdaten seiner Absätze unter `paragraphs[]` (ohne Inhalt). */
  async getChapter() {
    throw new Error('ContentRepository.getChapter is not implemented');
  }

  /** Einzelner Absatz mit vollem Inhalt. */
  async getParagraph() {
    throw new Error('ContentRepository.getParagraph is not implemented');
  }

  /**
   * Vollständiger Inhaltsbaum (`stories[].chapters[]`), **ungefiltert** —
   * veröffentlicht und unveröffentlicht. Der Publish-Filter läuft erst bei der
   * Auslieferung im `ContentVisibilityFilter`, damit dieselbe Baum-Quelle auch
   * für andere Zwecke (z. B. `sitemap.xml`) nutzbar bleibt.
   */
  async getContentsTree() {
    throw new Error('ContentRepository.getContentsTree is not implemented');
  }
}

module.exports = { ContentRepository };
