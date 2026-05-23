const express = require('express');
const request = require('supertest');

const {
  createCompressionMiddleware,
  COMPRESSION_THRESHOLD_ENV_KEY,
} = require('../modules/httpCompression');

function createTestApp() {
  const app = express();
  app.use(
    createCompressionMiddleware({
      [COMPRESSION_THRESHOLD_ENV_KEY]: '1024',
    })
  );

  app.get('/text', (req, res) => {
    res.type('text/plain').send('x'.repeat(4096));
  });

  app.get('/small', (req, res) => {
    res.type('application/json').send({ ok: true });
  });

  app.get('/binary', (req, res) => {
    res.type('application/octet-stream').send(Buffer.alloc(4096, 1));
  });

  return app;
}

describe('http compression integration', () => {
  it('should prefer Brotli when the client accepts br', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/text')
      .set('Accept-Encoding', 'br, gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('br');
  });

  it('should fallback to gzip when only gzip is accepted', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/text')
      .set('Accept-Encoding', 'gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('gzip');
  });

  it('should not compress responses smaller than the configured threshold', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/small')
      .set('Accept-Encoding', 'br, gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBeUndefined();
  });

  it('should not compress binary content types', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/binary')
      .set('Accept-Encoding', 'br, gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBeUndefined();
  });
});
