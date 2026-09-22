import sanitizeHtml from 'sanitize-html';

/** Shared allowlist for HTML produced by the editor. */
export function sanitizeContent(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
      th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
    },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, rel: attrs.target === '_blank' ? 'noopener noreferrer' : 'noopener' } }),
    },
  });
}
