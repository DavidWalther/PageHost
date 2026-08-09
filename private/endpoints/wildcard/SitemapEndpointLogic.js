const { Logging } = require('../../modules/logging');
const { EndpointLogic } = require('../EndpointLogic');
const { DataFacade } = require('../../database2/DataFacade');
const ContentVisibilityFilter = require('../../modules/ContentVisibilityFilter');

/**
 * `sitemap.xml` — die veröffentlichten Knoten als URL-Liste.
 *
 * Der Endpunkt hat lange auf `NotFoundEndpointLogic` verwiesen und damit 404
 * geliefert, obwohl der `ContentVisibilityFilter` ausdrücklich als
 * **wiederverwendbares** Modul für genau diesen Zweck gebaut wurde: der Cache
 * hält den vollständigen Baum, der Publish-Filter läuft erst bei der
 * Auslieferung. Damit kann dieselbe Quelle den Inhaltsbaum der App und die
 * Sitemap bedienen, ohne dass eine von beiden Unveröffentlichtes zeigt.
 *
 * Die URLs sind die Ids der Knoten — das Frontend löst jede Id über das
 * Backend auf (`bookstore.resolveEntryPoint`), eine Typangabe im Pfad gibt es
 * nicht mehr.
 */
class SitemapEndpointLogic extends EndpointLogic {
  async execute() {
    const LOCATION = 'Server.SitemapEndpoint.execute';

    Logging.debugMessage({
      severity: 'INFO',
      message: 'Executing sitemap.xml request',
      location: LOCATION,
    });

    const tree = await new DataFacade(this.environment).getData({
      returnPromise: true,
      request: { table: 'contents', id: null },
    });

    // Ohne `edit`-Scope: nur Veröffentlichtes. Die Sitemap kennt gar keine
    // Scopes — sie ist immer die öffentliche Sicht.
    const published = new ContentVisibilityFilter()
      .setTree(tree)
      .setChildrenKey('nodes')
      .setDateField('published_date')
      .setDate(new Date())
      .getResult();

    const xml = SitemapEndpointLogic.toXml(
      SitemapEndpointLogic.collectIds(published),
      this.baseUrl()
    );

    Logging.debugMessage({
      severity: 'FINER',
      message: `Sitemap with ${SitemapEndpointLogic.collectIds(published).length} urls`,
      location: LOCATION,
    });

    this.responseObject.set('Content-Type', 'application/xml').send(xml);
  }

  /**
   * Basis-URL der Sitemap. Sie muss absolut sein, deshalb kommt sie aus der
   * Anfrage — die App läuft unter mehreren Domains.
   */
  baseUrl() {
    const protocol = this.requestObject?.protocol || 'https';
    const host =
      (this.requestObject?.get && this.requestObject.get('host')) ||
      this.requestObject?.headers?.host ||
      '';
    return `${protocol}://${host}`;
  }

  /** Alle Knoten-Ids des Baums, Eltern vor Kindern. */
  static collectIds(nodes) {
    const ids = [];
    (nodes || []).forEach((node) => {
      if (node?.id) {
        ids.push(node.id);
      }
      ids.push(...SitemapEndpointLogic.collectIds(node?.nodes));
    });
    return ids;
  }

  static toXml(ids, baseUrl) {
    const urls = ids
      .map(
        (id) =>
          `  <url><loc>${baseUrl}/${SitemapEndpointLogic.escape(id)}</loc></url>`
      )
      .join('\n');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
      '',
    ]
      .filter((part) => part !== '')
      .join('\n');
  }

  /** Ids sind alphanumerisch; die Maskierung ist Vorsorge, kein Bedarf. */
  static escape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

module.exports = SitemapEndpointLogic;
