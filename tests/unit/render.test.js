import { describe, it, expect } from 'vitest';
import { renderCardContent, escapeHTML } from '../../src/ui/render.js';

describe('Safe Markdown and HTML Renderer', () => {
  it('escapes unallowed dangerous HTML tags to prevent XSS', () => {
    const malicious = '<script>alert("hack")</script><img src="x" onerror="steal()">';
    const output = renderCardContent(malicious, 'markdown');
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
    expect(output).not.toContain('<img');
    expect(output).toContain('&lt;img');
  });

  it('renders bold, italic and code blocks safely', () => {
    const markdown = '**Negrito** e *Itálico*\n```js\nconst x = 10;\n```';
    const output = renderCardContent(markdown, 'markdown');
    expect(output).toContain('<strong>Negrito</strong>');
    expect(output).toContain('<em>Itálico</em>');
    expect(output).toContain('<pre class="code-block"><code class="language-js">const x = 10;</code></pre>');
  });

  it('renders safe HTTP and HTTPS links', () => {
    const markdown = '[Google](https://google.com) e [XSS](javascript:alert(1))';
    const output = renderCardContent(markdown, 'markdown');
    expect(output).toContain('<a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a>');
    // javascript: URI must be stripped/rendered plain
    expect(output).not.toContain('href="javascript:');
  });
});
