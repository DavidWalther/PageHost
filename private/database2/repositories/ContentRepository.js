/**
 * Schnittstelle für die Inhaltsquelle — Lesen **und** Schreiben.
 *
 * Zweck: die Umstellung vom alten Datenmodell (`story`/`chapter`/`paragraph`)
 * auf das neue (`node`/`content_node`/`content_item`) so vorzubereiten, dass
 * **dieselben** Charakterisierungstests gegen beide Quellen laufen können.
 * Solange sie für beide grün sind, ist der Wechsel von außen nicht beobachtbar.
 *
 * Es gibt genau einen Umschaltpunkt: `DataFacadeSync.createContentRepository()`.
 * Der wählt seit der Umstellung über `CONTENT_SOURCE` — Standard ist das neue
 * Modell, `legacy` der Rückweg. Schalter und alte Implementierung verschwinden
 * gemeinsam mit den alten Tabellen.
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
/**
 * Objekte, für die diese Schnittstelle zuständig ist.
 *
 * Alles andere — `configuration`, `identity` — gehört nicht zur Umstellung und
 * spricht weiter direkt mit `DataStorage`. Die Liste steht hier und nicht in
 * der `DataFacade`, weil sie zur Schnittstelle gehört: wer sie erweitert, muss
 * beide Quellen bedienen.
 */
const CONTENT_OBJECTS = ['story', 'chapter', 'paragraph'];

class ContentRepository {
  /** Ist dieses Objekt Sache der Inhaltsquelle? */
  static owns(object) {
    return CONTENT_OBJECTS.includes(String(object).toLowerCase());
  }

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

  // ─── Schreibpfad ─────────────────────────────────────────────────────────
  //
  // Dieselbe Aufteilung wie beim Lesen: das Repository schreibt, die
  // `DataFacade` kümmert sich um den Cache. `object` ist weiterhin einer der
  // alten Namen (`story`, `chapter`, `paragraph`) — die Übersetzung auf
  // Knoten und Inhalte ist Sache der jeweiligen Quelle, nicht des Aufrufers.
  //
  // `configuration` läuft auch hier nicht mit: nicht Teil der Umstellung.

  /** Legt einen Datensatz an und liefert ihn zurück. */
  async createRecord() {
    throw new Error('ContentRepository.createRecord is not implemented');
  }

  /**
   * Aktualisiert die im Payload enthaltenen Felder. Der Payload trägt die Id;
   * alles andere sind zu setzende Werte — auch `publishDate`, worüber
   * Veröffentlichen und Zurückziehen laufen.
   */
  async updateRecord() {
    throw new Error('ContentRepository.updateRecord is not implemented');
  }

  /** Löscht einen Datensatz samt allem, was ohne ihn keinen Bestand hat. */
  async deleteRecord() {
    throw new Error('ContentRepository.deleteRecord is not implemented');
  }
}

module.exports = { ContentRepository, CONTENT_OBJECTS };
