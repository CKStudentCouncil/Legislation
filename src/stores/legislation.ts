import { acceptHMRUpdate, defineStore } from 'pinia';
import { getDoc } from 'firebase/firestore';
import type { Legislation } from 'src/ts/models.ts';
import { legislationDocument } from 'src/ts/model-converters.ts';
import { readWithRetry } from 'src/ts/firestore-retry.ts';

export const useLegislationStore = defineStore('legislation', {
  state: () => ({
    legislations: {} as Record<string, Legislation>,
  }),
  getters: {
    getLegislation: (state) => {
      return (legislation: string): Legislation | null => {
        const l = state.legislations[legislation];
        if (!l) return null;
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
      if (this.legislations[legislation]) return this.legislations[legislation];
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
