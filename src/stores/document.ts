import { acceptHMRUpdate, defineStore } from 'pinia';
import type * as models from 'src/ts/models.ts';
import { documentsCollection } from 'src/ts/models.ts';
import { doc, getDoc } from 'firebase/firestore';

export const useDocumentStore = defineStore('document', {
  state: () => ({
    document: {} as Record<string, models.Document>,
  }),
  getters: {
    getDocument: (state) => {
      return (document: string): models.Document | null => {
        if (state.document[document]) {
          state.document[document].createdAt = new Date(state.document[document].createdAt);
          state.document[document].publishedAt = state.document[document].publishedAt ? new Date(state.document[document].publishedAt) : null;
          state.document[document].meetingTime = state.document[document].meetingTime ? new Date(state.document[document].meetingTime) : null;
          state.document[document].getFullId = function () {
            return `${this.idPrefix}第${this.idNumber}號`;
          };
          return state.document[document];
        }
        return null;
      };
    },
  },
  actions: {
    async loadDocument(document: string): Promise<models.Document | null> {
      if (this.document[document]) return this.getDocument(document);
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
