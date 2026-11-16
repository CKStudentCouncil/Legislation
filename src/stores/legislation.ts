import { acceptHMRUpdate, defineStore } from 'pinia';
import { getDoc } from 'firebase/firestore';
import type { Legislation } from 'src/ts/models.ts';
import { legislationDocument } from 'src/ts/model-converters.ts';
import { readWithRetry } from 'src/ts/firestore-retry.ts';
import { canNameDocument, hasOwn } from 'src/ts/shared-utils.ts';

export const useLegislationStore = defineStore('legislation', {
  // Typed as the return type, not `{} as Record<…>`: see the note on DocumentState in stores/document.ts.
  state: (): { legislations: Record<string, Legislation> } => ({
    legislations: {},
  }),
  getters: {
    getLegislation: (state) => {
      return (legislation: string): Legislation | null => {
        // Own entries only. The id is whatever the visitor put in `/legislation/:id`, and `constructor` or `toString` would otherwise
        // resolve through the prototype chain to a built-in function, which the page then rendered as a law and crashed on. The entry is
        // read first so the lookup stays reactive.
        const l = state.legislations[legislation];
        if (!l || !hasOwn(state.legislations, legislation)) return null;
        l.history.map((h) => {
          h.amendedAt = new Date(h.amendedAt);
          return h;
        });
        l.addendum?.map((a) => {
          a.createdAt = new Date(a.createdAt);
        });
        return l;
      };
    },
  },
  actions: {
    async loadLegislation(legislation: string): Promise<Legislation | null> {
      if (this.legislations[legislation] && hasOwn(this.legislations, legislation)) return this.legislations[legislation];
      // An id Firestore cannot hold (`__proto__`, `__x__`, anything with a `/`) names no law. Answer it as not found instead of sending it:
      // the read failed with invalid-argument (and a `/` threw before it), which nothing catches, so the render returned 500.
      if (!canNameDocument(legislation)) return null;
      // The reference is built before the first await: legislationDocument() resolves Firestore through
      // vuefire, which is only meant to be called synchronously from setup.
      const ref = legislationDocument(legislation);
      const doc = await readWithRetry(() => getDoc(ref));
      if (doc.exists()) {
        this.legislations[legislation] = doc.data() as Legislation;
        return this.legislations[legislation];
      } else {
        console.error('No such document!');
        return null;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLegislationStore, import.meta.hot));
}
