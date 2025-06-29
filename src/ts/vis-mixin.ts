import instantsearch from 'instantsearch.js/es';
import { getInitialResults, waitForResults } from 'instantsearch.js/es/lib/server';

import { createSSRApp, isVue2, isVue3 } from 'vue-instantsearch/vue3/es/src/util/vue-compat/index-vue3';
import { warn } from 'vue-instantsearch/vue3/es/src/util/warn';

function defaultCloneComponent(componentInstance: any, { mixins = [] } = {}) {
  const options = {
    serverPrefetch: undefined,
    fetch: undefined,
    _base: undefined,
    name: 'ais-ssr-root-component',
    template: '<div></div>',
  } as any;

  let app;

  if (isVue3) {
    const appOptions = Object.assign({}, componentInstance.$options, options);
    appOptions.mixins = [...mixins, ...(appOptions.mixins || [])];
    app = createSSRApp(appOptions);
    if (componentInstance.$router) {
      app.use(componentInstance.$router);
    }
    if (componentInstance.$store) {
      app.use(componentInstance.$store);
    }
    if (componentInstance.$i18n) {
      app.use(componentInstance.$i18n);
    }
  } else {
    // copy over global Vue APIs
    options.router = componentInstance.$router;
    options.store = componentInstance.$store;
    options.i18n = componentInstance.$i18n;

    const Extended = componentInstance.$vnode.componentOptions.Ctor.extend(options);

    app = new Extended({
      propsData: componentInstance.$options.propsData,
      mixins: [...mixins],
    });
  }

  // https://stackoverflow.com/a/48195006/3185307
  app.$slots = componentInstance.$slots;
  app.$root = componentInstance.$root;
  if (isVue2) {
    app.$options.serverPrefetch = [];
  }

  return app;
}

function augmentInstantSearch(instantSearchOptions: any, cloneComponent: any) {
  const search = instantsearch(instantSearchOptions) as any;

  let initialResults: any;

  /**
   * main API for SSR, called in serverPrefetch of a root component which contains instantsearch
   * @param {Object} props the object including `component` and `renderToString`
   * @param {Object} props.component the calling component's `this`
   * @param {Function} props.renderToString the function to render componentInstance to string
   * @returns {Promise} result of the search, to save for .hydrate
   */
  search.findResultsState = function ({ component, renderToString }: { component: any; renderToString: (component: any) => Promise<string> }) {
    if (!renderToString) {
      throw new Error('findResultsState requires `renderToString: (component) => Promise<string>` in the first argument.');
    }

    let app: any;
    let instance: any;

    return Promise.resolve()
      .then(() => {
        app = cloneComponent(component, {
          mixins: [
            {
              beforeCreate() {
                const descriptor = Object.getOwnPropertyDescriptor(component, '$nuxt');

                const isWritable = descriptor
                  ? // eslint-disable-next-line @typescript-eslint/unbound-method
                    descriptor.writable || descriptor.set
                  : false;
              },
              created() {
                instance = search;
                instance.start();
                // although we use start for initializing the main index,
                // we don't want to send search requests yet
                instance.started = false;
              },
            },
          ],
        });
      })
      .then(() => renderToString(app))
      .then(() => waitForResults(instance))
      .then((requestParamsList) => {
        initialResults = getInitialResults(instance.mainIndex, requestParamsList);
        search.hydrate(initialResults);
        return search.getState();
      });
  };

  /**
   * @returns {Promise} result state to serialize and enter into .hydrate
   */
  search.getState = function () {
    if (!initialResults) {
      throw new Error('You need to wait for findResultsState to finish');
    }
    return initialResults;
  };

  /**
   * make sure correct data is available in each widget's state.
   * called in widget mixin with (this.widget, this)
   *
   * @param {object} widget The widget instance
   * @param {object} parent The local parent index
   * @returns {void}
   */
  search.__forceRender = function (widget: any, parent: any) {
    const results = parent.getResults();

    // this happens when a different InstantSearch gets rendered initially,
    // after the hydrate finished. There's thus no initial results available.
    if (results === null) {
      return;
    }

    const state = results._state;

    const localHelper = parent.getHelper();
    // helper gets created in init, but that means it doesn't get the injected
    // parameters, because those are from the lastResults
    localHelper.state = state;

    widget.render({
      helper: localHelper,
      results,
      scopedResults: parent.getScopedResults(),
      parent,
      state,
      templatesConfig: {},
      createURL: parent.createURL,
      instantSearchInstance: search,
      searchMetadata: {
        isSearchStalled: false,
      },
    });
  };

  /**
   * Called both in server
   * @param {object} results a map of indexId: SearchResults
   * @returns {void}
   */
  search.hydrate = function (results: any) {
    if (!results) {
      warn('The result of `findResultsState()` needs to be passed to `hydrate()`.');
      return;
    }

    search._initialResults = results;

    search.start();
    search.started = false;
  };
  return search;
}

interface InstantSearchOptions {
  $cloneComponent?: typeof defaultCloneComponent;
  searchClient?: any;
  indexName?: string;
}

export function createServerRootMixin(instantSearchOptions: InstantSearchOptions = {}) {
  const { $cloneComponent = defaultCloneComponent } = instantSearchOptions;

  const search = augmentInstantSearch(instantSearchOptions, $cloneComponent);

  // put this in the user's root Vue instance
  // we can then reuse that InstantSearch instance seamlessly from `ais-instant-search-ssr`
  const rootMixin = {
    provide() {
      return {
        $_ais_ssrInstantSearchInstance: search,
      };
    },
    data() {
      return {
        // this is in data, so that the real & cloned render do not share
        // the same instantsearch instance.
        instantsearch: search,
      };
    },
  };

  return rootMixin;
}
