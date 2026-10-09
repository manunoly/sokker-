const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export const escapeHtml = (value: unknown): string =>
    String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
