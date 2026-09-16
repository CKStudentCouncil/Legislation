import { defineBoot } from '#q-app';

/**
 * Makes QInput/QSelect notice that an IME is composing.
 *
 * Quasar guesses at composition instead of asking: it tests `compositionupdate`'s data
 * against a CJK regex (private.use-key-composition) and only then sets `target.qComposing`,
 * the flag QInput reads to leave a half-typed word alone. The data is whatever the IME is
 * showing — ㄅㄆㄇ for 注音, Latin for 倉頡 and 拼音 — so the guess usually fails, and QInput
 * then treats each keystroke as finished input and moves the caret, which ends the
 * composition. Widening the regex cannot fix that; using the browser's own event can.
 *
 * This is what Vue's own v-model does for native inputs (`vModelText`), and what Quasar
 * already does for masked ones (QInput.js:106). `compositionend` is left to Quasar, which
 * clears the flag and emits the committed text.
 *
 * The cost is Vue's too: Android keyboards compose plain Latin, so those fields update per
 * word rather than per keystroke. Every field here takes Chinese, so it does not bite.
 */

type Composable = EventTarget & { qComposing?: boolean };

export default defineBoot(() => {
  if (import.meta.env.QUASAR_SERVER) return;

  // Capture phase, so the flag is set before QInput's own listener on the field runs.
  document.addEventListener(
    'compositionstart',
    (event) => {
      if (event.target !== null) (event.target as Composable).qComposing = true;
    },
    true,
  );

  // Safari and old UIWebViews can move focus without firing compositionend (QInput.js:48),
  // and a flag left set makes the field ignore every later keystroke. Safe to clear here:
  // compositionend and `change` both fire before focusout, so Quasar has already flushed.
  document.addEventListener(
    'focusout',
    (event) => {
      const target: Composable | null = event.target;
      if (target?.qComposing === true) target.qComposing = false;
    },
    true,
  );
});
