const { Sanitizer } = require("../actions/sanitizer");

describe("Sanitizer", () => {
  test("sanitizes and desanitizes single quote (')", () => {
    const input = "O'Reilly";
    const sanitized = Sanitizer.sanitize(input);
    expect(sanitized).toBe("O''Reilly");
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });

  test("sanitizes and desanitizes semicolon (;)", () => {
    const input = "test; DROP TABLE users;";
    const sanitized = Sanitizer.sanitize(input);
    // Semicolon is not changed by sanitizer, so should be the same
    expect(sanitized).toBe(input);
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });

  test("sanitizes and desanitizes double dash (--)", () => {
    const input = "test -- comment";
    const sanitized = Sanitizer.sanitize(input);
    // Double dash is not changed by sanitizer, so should be the same
    expect(sanitized).toBe(input);
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });

  test("sanitizes and desanitizes comment block (/* ... */)", () => {
    const input = "test /* comment */";
    const sanitized = Sanitizer.sanitize(input);
    // Comment block is not changed by sanitizer, so should be the same
    expect(sanitized).toBe(input);
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });

  test("sanitizes and desanitizes backslash (\\)", () => {
    const input = "test \\ path";
    const sanitized = Sanitizer.sanitize(input);
    // Backslash is not changed by sanitizer, so should be the same
    expect(sanitized).toBe(input);
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });

  test("sanitizes and desanitizes percent (%)", () => {
    const input = "100% sure";
    const sanitized = Sanitizer.sanitize(input);
    // Percent is not changed by sanitizer, so should be the same
    expect(sanitized).toBe(input);
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });

  test("sanitizes and desanitizes underscore (_) and equals (=)", () => {
    const input = "user_name = 'admin'";
    const sanitized = Sanitizer.sanitize(input);
    expect(sanitized).toBe("user_name = ''admin''");
    const desanitized = Sanitizer.desanitize(sanitized);
    expect(desanitized).toBe(input);
  });
});
