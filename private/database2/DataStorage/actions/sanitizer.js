// Simple sanitizer/desanitizer utility
// You can expand this logic as needed for your use case

class Sanitizer {
  // Example: escape single quotes and trim whitespace
  static sanitize(value) {
    if (typeof value === 'string') {
      return value.replace(/'/g, "''").trim();
    }
    return value;
  }

  // Example: revert escaping
  static desanitize(value) {
    if (typeof value === 'string') {
      return value.replace(/''/g, "'");
    }
    return value;
  }
}

module.exports = { Sanitizer };
