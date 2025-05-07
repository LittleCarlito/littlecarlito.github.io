import { formatHtml, hasExternalFormatter } from '../asset_debugger/core/html-formatter.js';

describe('HTML Formatter Basic Tests', () => {
  // Test 1: Basic HTML formatting
  test('should format basic HTML correctly', () => {
    const input = '<div><p>Hello</p></div>';
    const formatted = formatHtml(input);
    expect(formatted).toContain('<div>');
    expect(formatted).toContain('<p>Hello</p>');
    expect(formatted).toContain('</div>');
  });
  
  // Test 2: CSS styles with indentation issues
  test('should format CSS styles in HTML correctly', () => {
    const input = `<style>
  body{
 margin:0;
            padding:80px 0 0 0;
  }</style>`;
    const formatted = formatHtml(input);
    expect(formatted).toContain('body {');
    expect(formatted).toContain('margin: 0;');
    expect(formatted).toContain('padding: 80px 0 0 0;');
  });
  
  // Test 3: Partial CSS selection (simulating selected text)
  test('should format standalone CSS correctly', () => {
    const input = `body{
 margin:0;
            padding:80px 0 0 0;
  }`;
    const formatted = formatHtml(input);
    expect(formatted).toContain('body {');
    expect(formatted).toContain('margin: 0;');
    expect(formatted).toContain('padding: 80px 0 0 0;');
  });
  
  // Test 4: Complex HTML with deeply nested structure
  test('should format complex HTML correctly', () => {
    const input = `<!DOCTYPE html><html><head><title>Test</title></head><body><div class="container"><div class="row"><div class="col"><p>Nested content</p></div></div></div></body></html>`;
    const formatted = formatHtml(input);
    expect(formatted).toContain('<!DOCTYPE html>');
    expect(formatted).toContain('<head>');
    expect(formatted).toContain('<div class="container">');
    expect(formatted).toContain('<p>Nested content</p>');
  });
  
  // Test 5: Format specific CSS blocks from user example
  test('should format CSS blocks from user example correctly', () => {
    const input = `        .message{
            padding:8px 12px;
            border-radius:20px;
            font-size:15px;
            max-width:75%;
            margin:5px;
            opacity:0;
            position:relative;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
            transform-origin: center bottom;
        }`;
    const formatted = formatHtml(input);
    expect(formatted).toContain('.message {');
    expect(formatted).toContain('padding: 8px 12px;');
    expect(formatted).toContain('border-radius: 20px;');
    expect(formatted).toContain('box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);');
  });
  
  // Test for external formatter
  test('should report that external formatter is available', () => {
    expect(hasExternalFormatter()).toBe(true);
  });
}); 