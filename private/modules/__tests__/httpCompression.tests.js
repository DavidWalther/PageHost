const {
  COMPRESSION_THRESHOLD_ENV_KEY,
  getCompressionThresholdBytes,
  isTextBasedContentType,
  shouldCompressResponse,
} = require('../httpCompression');

describe('httpCompression', () => {
  describe('getCompressionThresholdBytes', () => {
    it('should read the threshold from the environment variable', () => {
      expect(
        getCompressionThresholdBytes({
          [COMPRESSION_THRESHOLD_ENV_KEY]: '2048',
        })
      ).toBe(2048);
    });
  });

  describe('isTextBasedContentType', () => {
    it('should return true for text-based content types', () => {
      expect(isTextBasedContentType('text/html; charset=utf-8')).toBe(true);
      expect(isTextBasedContentType('application/json')).toBe(true);
      expect(isTextBasedContentType('application/javascript')).toBe(true);
      expect(isTextBasedContentType('image/svg+xml')).toBe(true);
    });

    it('should return false for binary content types', () => {
      expect(isTextBasedContentType('application/octet-stream')).toBe(false);
      expect(isTextBasedContentType('image/png')).toBe(false);
    });
  });

  describe('shouldCompressResponse', () => {
    it('should return true for text content when compression.filter allows it', () => {
      const req = { headers: { 'accept-encoding': 'gzip, br' } };
      const res = {
        getHeader: jest.fn((headerName) => {
          if (headerName === 'Content-Type') {
            return 'text/plain; charset=utf-8';
          }
          return undefined;
        }),
      };

      expect(shouldCompressResponse(req, res)).toBe(true);
    });

    it('should return false for binary content', () => {
      const req = { headers: { 'accept-encoding': 'gzip, br' } };
      const res = {
        getHeader: jest.fn((headerName) => {
          if (headerName === 'Content-Type') {
            return 'application/octet-stream';
          }
          return undefined;
        }),
      };

      expect(shouldCompressResponse(req, res)).toBe(false);
    });

    it('should return false when a response is already encoded', () => {
      const req = { headers: { 'accept-encoding': 'gzip, br' } };
      const res = {
        getHeader: jest.fn((headerName) => {
          if (headerName === 'Content-Type') {
            return 'text/plain';
          }
          if (headerName === 'Content-Encoding') {
            return 'gzip';
          }
          return undefined;
        }),
      };

      expect(shouldCompressResponse(req, res)).toBe(false);
    });
  });
});
