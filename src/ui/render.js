/**
 * Safe, minimal markdown renderer and HTML sanitizer.
 * Renders paragraphs, lists, bold, italics, links, inline code and code blocks safely.
 * Prevents XSS attacks by escaping all unallowed HTML entities.
 */

/**
 * Escapes raw HTML characters to prevent XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHTML(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renders safe markdown or plaintext
 * @param {string} content
 * @param {'plain'|'markdown'} [format='plain']
 * @returns {string} Safe HTML string
 */
export function renderCardContent(content, format = 'plain') {
  if (!content) return '';

  if (format === 'plain') {
    return `<p>${escapeHTML(content).replace(/\n/g, '<br>')}</p>`;
  }

  // Safe markdown parsing pipeline
  let text = escapeHTML(content);

  // 1. Code blocks: ```lang\ncode\n```
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // 2. Inline code: `code`
  text = text.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>');

  // 3. Bold: **text** or __text__
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // 4. Italic: *text* or _text_
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Links: [label](url) - strictly sanitize protocol to http/https/mailto
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const cleanUrl = url.trim();
    if (/^(https?:\/\/|mailto:)/i.test(cleanUrl)) {
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    return label;
  });

  // 6. Split into blocks/paragraphs
  const lines = text.split('\n');
  const output = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet lists: * or -
    if (/^[\*\-]\s+(.*)$/.test(line)) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${line.replace(/^[\*\-]\s+/, '')}</li>`);
    } else {
      if (inList) {
        output.push('</ul>');
        inList = false;
      }
      if (line.trim().length > 0) {
        // Don't wrap pre tags inside p
        if (line.includes('<pre') || line.includes('</pre>')) {
          output.push(line);
        } else {
          output.push(`<p>${line}</p>`);
        }
      }
    }
  }

  if (inList) {
    output.push('</ul>');
  }

  return output.join('');
}
