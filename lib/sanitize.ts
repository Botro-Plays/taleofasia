import DOMPurify from 'isomorphic-dompurify';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'blockquote', 'code', 'pre', 'hr', 'dl', 'dt', 'dd',
      'svg', 'path', 'circle', 'rect', 'polygon', 'line', 'polyline', 'g', 'text',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
      'width', 'height', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan',
      'viewBox', 'fill', 'xmlns', 'd', 'cx', 'cy', 'r', 'x', 'y', 'points',
      'text-anchor', 'font-size', 'font-weight', 'font-family',
    ],
    ALLOW_DATA_ATTR: false,
    SANITIZE_DOM: true,
  });
}
