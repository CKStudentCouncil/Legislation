import sanitize from 'sanitize-html';

const sanitizeDefaults = (
  sanitize as unknown as {
    defaults: { allowedTags: string[]; allowedAttributes: Record<string, string[]> };
  }
).defaults;

/**
 * Synchronously sanitize user-authored HTML for safe rendering via v-html.
 *
 * Kept in a dedicated module that *statically* imports sanitize-html (rather than
 * the async dynamic import that used to live in utils.ts) so the sanitization runs
 * during the synchronous SSR render pass — otherwise the document body is empty in
 * the server-rendered HTML (see SafeHtml.vue). This module is only imported by
 * SafeHtml, so sanitize-html stays code-split with the lazy /document route chunk
 * instead of the global bundle.
 */
export function customSanitize(text: string): string {
  return sanitize(text, {
    allowedTags: sanitizeDefaults.allowedTags.concat(['font']),
    // Build a fresh object — Object.assign onto sanitizeDefaults.allowedAttributes would
    // permanently mutate sanitize-html's shared global defaults (a process-wide side effect).
    allowedAttributes: {
      ...sanitizeDefaults.allowedAttributes,
      font: ['color', 'size'],
      div: ['style'],
    },
    allowedStyles: {
      '*': {
        // Match HEX and RGB
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
        'text-align': [/^left$/, /^right$/, /^center$/],
        // Match any number with px, em, %, or small, medium, large
        'font-size': [/^\d+(px|em|%)$/, /^(small|medium|large)$/],
      },
      p: {
        'font-size': [/^\d+(px|em|%)$/, /^(small|medium|large)$/],
      },
    },
  });
}
