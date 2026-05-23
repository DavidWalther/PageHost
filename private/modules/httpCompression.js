const compression = require('compression');

const COMPRESSION_THRESHOLD_ENV_KEY = 'COMPRESSION_THRESHOLD_BYTES';

function getCompressionThresholdBytes(environment = {}) {
  return Number.parseInt(environment[COMPRESSION_THRESHOLD_ENV_KEY], 10);
}

function isTextBasedContentType(contentType = '') {
  const normalized = String(contentType).toLowerCase();

  return (
    normalized.startsWith('text/') ||
    normalized.includes('application/json') ||
    normalized.includes('application/javascript') ||
    normalized.includes('application/xml') ||
    normalized.includes('application/xhtml+xml') ||
    normalized.includes('image/svg+xml')
  );
}

function shouldCompressResponse(req, res) {
  if (!compression.filter(req, res)) {
    return false;
  }

  if (res.getHeader('Content-Encoding')) {
    return false;
  }

  const contentType = res.getHeader('Content-Type');
  if (!contentType) {
    return false;
  }

  return isTextBasedContentType(contentType);
}

function createCompressionMiddleware(environment = {}) {
  return compression({
    threshold: getCompressionThresholdBytes(environment),
    filter: shouldCompressResponse,
    brotli: { enabled: true },
  });
}

module.exports = {
  COMPRESSION_THRESHOLD_ENV_KEY,
  createCompressionMiddleware,
  getCompressionThresholdBytes,
  isTextBasedContentType,
  shouldCompressResponse,
};
