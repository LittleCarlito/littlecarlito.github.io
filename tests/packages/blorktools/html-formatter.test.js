/**
 * HTML Formatter Tests
 * 
 * Tests for the HTML formatter in blorktools
 */

import { formatHtml, hasExternalFormatter } from "../../../packages/blorktools/src/asset_debugger/util/data/html-formatter";


describe('HTML Formatter', () => {
  test('should format basic HTML correctly', () => {
    const input = '<div><p>Hello</p></div>';
    const expected = '<div>\n  <p>Hello</p>\n</div>';
    expect(formatHtml(input).replace(/\r\n/g, '\n')).toContain(expected);
  });

  test('should format CSS within HTML correctly', () => {
    const input = '<style>body{margin:0; padding:0;}</style>';
    const expected = '<style>\n  body {\n    margin: 0;\n    padding: 0;\n  }';
    expect(formatHtml(input).replace(/\r\n/g, '\n')).toContain(expected);
  });

  test('should format CSS snippets correctly', () => {
    const input = `body{
 margin:0;
            padding:80px 0 0 0;
  }`;
    const expected = 'body {\n  margin: 0;\n  padding: 80px 0 0 0;\n}';
    expect(formatHtml(input).replace(/\r\n/g, '\n')).toContain(expected);
  });

  test('should format complex nested HTML correctly', () => {
    const input = '<!DOCTYPE html><html><head><title>Test</title></head><body><div><p>Content</p></div></body></html>';
    const expected = '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Test</title>';
    expect(formatHtml(input).replace(/\r\n/g, '\n')).toContain(expected);
  });

  test('should handle CSS selectors correctly', () => {
    const input = `.message{
            padding:8px 12px;
            border-radius:20px;
        }`;
    const formatted = formatHtml(input);
    expect(formatted).toContain('padding: 8px 12px');
    expect(formatted).toContain('border-radius: 20px');
  });

  test('should maintain proper indentation in multi-level HTML', () => {
    const input = '<div><div><div><p>Deeply nested</p></div></div></div>';
    const formatted = formatHtml(input);
    expect(formatted).toContain('    <p>Deeply nested</p>');
  });

  test('should format selected CSS block from a larger document', () => {
    // This simulates a user selecting just a CSS rule to format
    const input = `        body{
 margin:0;
            padding:80px 0 0 0;
            background-color:transparent;
        }`;
    const formatted = formatHtml(input);
    expect(formatted).toContain('margin: 0');
    expect(formatted).toContain('padding: 80px 0 0 0');
    expect(formatted).toContain('background-color: transparent');
  });

  test('should report external formatter availability', () => {
    expect(hasExternalFormatter()).toBe(true);
  });
}); 