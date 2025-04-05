import { acceptHMRUpdate, defineStore } from 'pinia';
import type * as models from 'src/ts/models.ts';
import { documentsCollection } from 'src/ts/models.ts';
import { doc, getDoc } from 'firebase/firestore';

export const useDocumentStore = defineStore('myStore', {
  state: () => ({
    document: {} as Record<string, models.Document>,
  }),
  getters: {
    getDocument: (state) => {
      return (document: string): models.Document | null => {
        return state.document[document] || null;
      };
    },
  },
  actions: {
    async loadDocument(document: string): Promise<models.Document | null> {
      if (this.document[document]) return this.document[document];
      const docu = await getDoc(doc(documentsCollection(), document));
      if (docu.exists()) {
        this.document[document] = docu.data() as models.Document;
        return this.document[document];
      } else {
        console.error('No such document!');
        return null;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentStore, import.meta.hot));
}
