import { nextTick, onScopeDispose, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { notifyError } from 'src/ts/utils.ts';

/**
 * Client-only. Prints one element by isolating it inside the **live, top-level
 * document** and calling `window.print()` there.
 *
 * This deliberately does not clone the subtree into a hidden `<iframe>` the way
 * `vue-to-print` / `react-to-print` do. That model works on desktop but fails on
 * phones for two independent reasons:
 *
 *  1. `window.print()` only blocks on desktop. On iOS Safari and Chrome for
 *     Android it returns immediately and the print UI opens afterwards, so the
 *     library's `removeAfterPrint` tears the iframe — and the document the print
 *     job was about to read — out of the DOM mid-print.
 *  2. An iframe created in response to the tap never received that tap's user
 *     activation, and iOS Safari refuses to open the print sheet for a window
 *     that has none. The top-level window, by contrast, is still within its
 *     transient activation window when the button handler runs.
 *
 * Printing the real document sidesteps both, and needs no style copying, font
 * re-loading or image re-fetching either.
 */

/** Set on `<html>` for the duration of a print, so the rules below stay inert during a plain Ctrl+P. */
const ACTIVE_CLASS = 'is-printing';
/** The element being printed. */
const ROOT_CLASS = 'print-root';
/** Everything between `<body>` and the printed element; stripped of layout chrome. */
const ANCESTOR_CLASS = 'print-ancestor';
/** Every branch that is not on the path to the printed element. */
const HIDDEN_CLASS = 'print-hidden';
const PAGE_STYLE_ID = 'print-page-style';

/** Safari fires `afterprint` before the print sheet is dismissed; keep the isolated DOM around a little longer. */
const TEARDOWN_DELAY = 300;
/** Last resort if the browser reports neither `afterprint` nor a print media change. */
const FINISH_TIMEOUT = 30_000;

/** Marks content that should print in the official 標楷體; see `.official-font-when-printing` in app.scss. */
const OFFICIAL_FONT_CLASS = 'official-font-when-printing';
const KAI_WEBFONT_FAMILY = 'LXGW WenKai TC';
const KAI_WEBFONT_HREF = 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&display=swap';
const KAI_WEBFONT_LINK_ID = 'print-kai-font';
/** The locally installed Kai faces at the head of the stack in app.scss, in the same order. */
const LOCAL_KAI_FACES = ['標楷體2', '標楷體', 'BiauKai', 'DFKai-sb', 'TW-Kai', 'Kaiti TC'];
/** Spend at most this long on the font: the tap's user activation is only good for about five seconds. */
const FONT_TIMEOUT = 2500;

/** Exactly the classes this module added, so teardown removes nothing it does not own. */
let applied: [Element, string][] = [];

export interface PrintOptions {
  /** Element, component instance or template ref whose subtree should be printed. */
  content: MaybeRefOrGetter<HTMLElement | { $el?: Node } | null | undefined>;
  /** Print job title, which is also what browsers offer as the "Save as PDF" filename. */
  documentTitle?: MaybeRefOrGetter<string>;
  /** CSS injected for the duration of the print, typically an `@page` rule. */
  pageStyle?: string;
  /** Swap in a print-friendly rendering here; the DOM is re-read on the next tick. */
  onBeforePrint?: () => void;
  /** Undo `onBeforePrint` here. Runs once the browser is done with the document. */
  onAfterPrint?: () => void;
}

function resolveElement(content: PrintOptions['content']): HTMLElement | null {
  const value = toValue(content);
  if (!value) {
    return null;
  }
  if (value instanceof HTMLElement) {
    return value;
  }
  const el = value.$el;
  if (!el) {
    return null;
  }
  const resolved = el.nodeType === Node.TEXT_NODE ? el.parentElement : el;
  return resolved instanceof HTMLElement ? resolved : null;
}

function addClass(element: Element, className: string) {
  if (element.classList.contains(className)) {
    return;
  }
  element.classList.add(className);
  applied.push([element, className]);
}

/** Hide every branch of the document that is not on the path to `target`, so `window.print()` emits just that subtree. */
function isolate(target: HTMLElement) {
  clearIsolation();
  addClass(target, ROOT_CLASS);
  let node: HTMLElement = target;
  while (node.parentElement && node.parentElement !== document.documentElement) {
    const parent = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling !== node) {
        addClass(sibling, HIDDEN_CLASS);
      }
    }
    addClass(parent, ANCESTOR_CLASS);
    node = parent;
  }
  document.documentElement.classList.add(ACTIVE_CLASS);
}

function clearIsolation() {
  for (const [element, className] of applied) {
    element.classList.remove(className);
  }
  applied = [];
  document.documentElement.classList.remove(ACTIVE_CLASS);
}

function setPageStyle(css?: string) {
  const existing = document.getElementById(PAGE_STYLE_ID);
  if (!css) {
    existing?.remove();
    return;
  }
  const style = existing ?? document.createElement('style');
  style.id = PAGE_STYLE_ID;
  style.textContent = css;
  if (!existing) {
    document.head.appendChild(style);
  }
}

function measureProbe(fontFamily: string) {
  const span = document.createElement('span');
  // Latin, because CJK glyphs are square in every font and so measure the same whichever one wins.
  span.textContent = 'mmmmmmmmmmlliWWW';
  span.style.cssText = `position:absolute;top:-9999px;left:-9999px;visibility:hidden;white-space:nowrap;font-size:96px;font-family:${fontFamily}`;
  document.body.appendChild(span);
  const width = span.getBoundingClientRect().width;
  span.remove();
  return width;
}

let localKai: boolean | undefined;

/** True if the device has a Kai face of its own, i.e. if downloading one would be wasted bytes. */
function hasLocalKaiFont() {
  if (localKai === undefined) {
    const generics = ['monospace', 'serif', 'sans-serif'] as const;
    const baselines = generics.map(measureProbe);
    localKai = LOCAL_KAI_FACES.some((face) => generics.some((generic, i) => measureProbe(`'${face}',${generic}`) !== baselines[i]));
  }
  return localKai;
}

/**
 * Every Kai face in the official stack is a locally installed desktop font, so phones fall back to
 * a generic serif. When the content asks for that stack and the device has no Kai of its own, pull
 * one from Google Fonts — only then, and only the unicode subsets the printed text actually needs,
 * so readers who already have 標楷體 never download anything. Never blocks: if the font has not
 * arrived in time we print with the fallback, and it is cached for the next attempt.
 */
async function loadOfficialFont(target: HTMLElement) {
  if (!document.fonts) {
    return;
  }
  if (!target.classList.contains(OFFICIAL_FONT_CLASS) && !target.querySelector(`.${OFFICIAL_FONT_CLASS}`)) {
    return;
  }
  if (hasLocalKaiFont()) {
    return;
  }

  let link = document.getElementById(KAI_WEBFONT_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = KAI_WEBFONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = KAI_WEBFONT_HREF;
    document.head.appendChild(link);
  }

  const sheet = link;
  const ready = (async () => {
    if (!sheet.sheet) {
      // The @font-face rules have to be parsed before document.fonts can match the family.
      await new Promise<void>((resolve) => {
        sheet.addEventListener('load', () => resolve(), { once: true });
        sheet.addEventListener('error', () => resolve(), { once: true });
      });
    }
    const characters = Array.from(new Set((target.textContent ?? '').replace(/\s/g, ''))).join('');
    await document.fonts.load(`400 16px '${KAI_WEBFONT_FAMILY}'`, characters);
  })();

  await Promise.race([ready.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT))]);
}

/**
 * Resolves once the browser has let go of the document. `afterprint` is the reliable signal on
 * desktop; Safari fires it early and some mobile browsers never fire it at all, so the `print`
 * media query and a timeout back it up.
 */
function createPrintWaiter() {
  let settle!: () => void;
  const done = new Promise<void>((resolve) => (settle = resolve));

  const printMedia = window.matchMedia('print');
  // MediaQueryList only grew addEventListener in Safari 14.
  const listenable = 'addEventListener' in printMedia;
  const onMediaChange = (e: MediaQueryListEvent) => {
    if (!e.matches) {
      finish();
    }
  };

  const timer = window.setTimeout(() => finish(), FINISH_TIMEOUT);

  function finish() {
    window.clearTimeout(timer);
    window.removeEventListener('afterprint', finish);
    if (listenable) {
      printMedia.removeEventListener('change', onMediaChange);
    }
    settle();
  }

  window.addEventListener('afterprint', finish);
  if (listenable) {
    printMedia.addEventListener('change', onMediaChange);
  }

  return { done, finish };
}

export function usePrint(options: PrintOptions) {
  let running = false;

  async function handlePrint() {
    if (running) {
      return;
    }

    const element = resolveElement(options.content);
    if (!element) {
      notifyError('沒有可列印的內容');
      return;
    }
    // Firefox for Android ships no window.print at all, so say so instead of failing silently.
    if (typeof window.print !== 'function') {
      notifyError('此瀏覽器不支援列印，請改用其他瀏覽器開啟本頁');
      return;
    }

    running = true;
    const previousTitle = document.title;
    try {
      options.onBeforePrint?.();
      // Let the print-only rendering (expanded clauses, de-embedded attachments) commit
      // before the browser paginates. Kept to a tick so the tap's user activation survives.
      await nextTick();
      await loadOfficialFont(element);

      const title = toValue(options.documentTitle);
      if (title) {
        document.title = title;
      }
      setPageStyle(options.pageStyle);
      isolate(element);

      const waiter = createPrintWaiter();
      try {
        window.print();
      } catch (e) {
        waiter.finish();
        notifyError('列印失敗', e);
      }
      await waiter.done;
      await new Promise((resolve) => setTimeout(resolve, TEARDOWN_DELAY));
    } finally {
      document.title = previousTitle;
      clearIsolation();
      setPageStyle();
      options.onAfterPrint?.();
      running = false;
    }
  }

  // `.print-ancestor` lands on <body> and #q-app, which outlive this page.
  onScopeDispose(() => {
    clearIsolation();
    setPageStyle();
  });

  return { handlePrint };
}
