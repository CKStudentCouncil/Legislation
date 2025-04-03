import { acceptHMRUpdate, defineStore } from 'pinia';
import { getDoc } from 'firebase/firestore';
import type { Legislation } from 'src/ts/models.ts';
import { legislationDocument } from 'src/ts/models.ts';

export const useLegislationStore = defineStore('legislation', {
  state: () => ({
    legislations: {} as Record<string, Legislation>,
  }),
  getters: {
    getLegislation: (state) => {
      return (legislation: string): Legislation | null => {
        return state.legislations[legislation] || null;
      };
    },
  },
  actions: {
    async loadLegislation(legislation: string): Promise<Legislation | null> {
      if (this.legislations[legislation]) return this.legislations[legislation];
      const doc = await getDoc(legislationDocument(legislation));
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
