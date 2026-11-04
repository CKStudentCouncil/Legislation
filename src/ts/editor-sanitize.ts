// Client-only: `document` is touched inside the function, never at module load, but nothing on a server-rendered path should import this.

const MAX_PASSES = 5;

// Never wanted in document text. `script` is inert when parsed through innerHTML (SafeHtml strips it on display anyway); `noscript` is
// parsed as markup by the inert parser used below but as raw text by the live page (a classic mutation-XSS gadget); `base` re-points
// every relative URL on the page.
const REMOVED_ELEMENTS = new Set(['script', 'noscript', 'base']);

// Elements that embed another document or plugin content. They are kept; only the forms that can run script are stripped from them.
const EMBED_ELEMENTS = new Set(['iframe', 'frame', 'object', 'embed', 'portal', 'fencedframe']);

// SVG animation can rewrite a link target or handler after the static attribute checks below have run.
const ANIMATION_ELEMENTS = new Set(['animate', 'set', 'animatetransform', 'animatemotion']);
const ANIMATED_ATTRIBUTE = /^(?:xlink:)?(?:href|src|action|formaction|on.*)$/;

// Attributes whose value is a URL that a click, a form submission or a navigation can follow.
const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction']);
const SCRIPT_URL = /^(?:javascript|vbscript):/;

// The clean-up a URL parser does before it looks for a scheme: leading/trailing C0 control or space are trimmed, tab/LF/CR are dropped.
function normaliseUrl(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 0x20) start++;
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end--;
  return value.slice(start, end).replace(/[\t\n\r]/g, '').toLowerCase();
}

function isUnsafeAttribute(tag: string, attr: Attr): boolean {
  const name = attr.name.toLowerCase();
  if (name.startsWith('on')) return true; // event handler
  const embed = EMBED_ELEMENTS.has(tag);
  if (embed && name === 'srcdoc') return true; // an inline document runs with the embedding page's origin
  const embedSource = embed && (name === 'src' || name === 'data');
  if (!embedSource && !URL_ATTRIBUTES.has(name)) return false;
  const url = normaliseUrl(attr.value);
  if (SCRIPT_URL.test(url)) return true;
  // A data: URL cannot script this origin from a link or an image, but can as the document behind a frame/plugin or as an SVG <use> target.
  return url.startsWith('data:') && (embedSource || (tag === 'use' && (name === 'href' || name === 'xlink:href')));
}

function isUnsafeElement(el: Element, tag: string): boolean {
  if (REMOVED_ELEMENTS.has(tag)) return true;
  if (tag === 'meta') return (el.getAttribute('http-equiv') ?? '').trim().toLowerCase() === 'refresh';
  return ANIMATION_ELEMENTS.has(tag) && ANIMATED_ATTRIBUTE.test((el.getAttribute('attributeName') ?? '').trim().toLowerCase());
}

/** Removes everything above from `root` (including `<template>` contents) and reports whether anything had to go. */
function strip(root: ParentNode): boolean {
  let changed = false;
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.localName.toLowerCase();
    if (isUnsafeElement(el, tag)) {
      el.remove();
      changed = true;
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      if (isUnsafeAttribute(tag, attr)) {
        el.removeAttributeNode(attr);
        changed = true;
      }
    }
    const templateContent = tag === 'template' ? (el as HTMLTemplateElement).content : undefined;
    if (templateContent && strip(templateContent)) changed = true;
  }
  return changed;
}

// Parsed in an inert document (no browsing context), so nothing loads and no handler fires while the markup is being inspected.
function parse(html: string): HTMLElement {
  const container = document.implementation.createHTMLDocument('').createElement('div');
  container.innerHTML = html;
  return container;
}

/**
 * Make stored document HTML safe to hand to QEditor as its model.
 *
 * QEditor writes the model into the page with `innerHTML` (on mount, on every external model change and when "view source" is toggled
 * off) and emits `innerHTML` again on every keystroke, so the HTML is parsed, serialised and re-parsed during an editing session. Stored
 * HTML can be written by any signed-in user, so a string is only returned when a parse of it is clean, and a parse of that parse's
 * serialisation is clean too and serialises to the same string: from there the parse/serialise cycle cannot change and cannot surface
 * anything new (mutation XSS). Clean input is returned byte-for-byte; otherwise the cleaned serialisation is checked the same way, and
 * '' is returned if it never settles.
 */
export function sanitizeEditorHtml(html: string): string {
  if (!html) return html;
  let current = html;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const first = parse(current);
    const changed = strip(first);
    const once = first.innerHTML;
    if (!changed) {
      const second = parse(once);
      if (!strip(second) && second.innerHTML === once) return current;
    }
    current = once;
  }
  return '';
}
