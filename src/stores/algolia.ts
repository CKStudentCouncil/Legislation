import { acceptHMRUpdate, defineStore } from 'pinia';

export const useAlgoliaStore = defineStore('algolia', {
  state: () => ({
    algoliaState: {} as any,
  }),
  getters: {
    getState: (state) => {
      return (): any => {
        return state.algoliaState;
      };
    },
    hasState: (state) => {
      return (): boolean => {
        return state.algoliaState && Object.values(state.algoliaState).length > 0
      }
    }
  },
  actions: {
    setState(algoliaState: any) {
      this.algoliaState = algoliaState;
    },
    clearState() {
      this.algoliaState = {};
    }
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAlgoliaStore, import.meta.hot));
}
