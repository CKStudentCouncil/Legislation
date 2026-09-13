// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig((ctx) => {
  /**
   * Sentry. Every piece below is inert when its environment variable is missing, so a
   * checkout with no Sentry env in scope builds exactly what it built before. See
   * CLAUDE.md > Error reporting for which variable is read by which runtime.
   *
   * These go through `defineEnv` rather than the QCLI_ client prefix on purpose: defineEnv
   * guarantees the keys exist as typed literals in `import.meta.env` even on a machine
   * that has none of them set. That is what lets src/boot/sentry.ts fold its guards to
   * constants (so Rolldown drops the whole SDK) instead of failing the vue-tsc pass with
   * "property does not exist on type ImportMetaEnv".
   */
  const clamp01 = (value: string | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
  };
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? '';
  const sentryOrg = process.env.SENTRY_ORG ?? '';
  const sentryProject = process.env.SENTRY_PROJECT ?? '';
  const sentryRelease = process.env.SENTRY_RELEASE ?? '';
  // A minified stack trace is worthless, so source maps are generated only when there is
  // somewhere to upload them to. The plugin deletes them again once the upload succeeds,
  // so they never reach dist/spa and never get served to visitors.
  const uploadSourcemaps = ctx.prod && sentryAuthToken !== '' && sentryOrg !== '' && sentryProject !== '';

  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    // 'sentry' first: it installs the Vue error handler, so anything the later boot files
    // throw is already being reported by the time they run.
    boot: ['sentry', 'vuefire'],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#css
    css: ['app.scss'],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      // 'fontawesome-v6',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      // 'roboto-font' dropped: UI is Traditional Chinese (system CJK fonts); the Latin
      // webfont was render-blocking weight for little benefit. Re-add if Latin UI regresses.
      'material-icons', // optional, you are not bound to it
    ],

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#build
    build: {
      // @quasar/app-vite v3 ships only '@' -> /src and '#q-app'; it dropped the
      // v2 folder aliases the codebase imports through ('src/…', 'components/…',
      // 'boot/…', 'stores/…', 'pages/…', 'layouts/…'). Re-declare them here —
      // build.alias feeds both Vite resolution and the generated .quasar/tsconfig
      // paths, so restoring them keeps every existing import working.
      alias: {
        src: ctx.appPaths.srcDir,
        app: ctx.appPaths.appDir,
        assets: ctx.appPaths.resolve.src('assets'),
        boot: ctx.appPaths.resolve.src('boot'),
        components: ctx.appPaths.resolve.src('components'),
        layouts: ctx.appPaths.resolve.src('layouts'),
        pages: ctx.appPaths.resolve.src('pages'),
        stores: ctx.appPaths.resolve.src('stores'),
      },

      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node22',
      },

      defineEnv: {
        SENTRY_DSN: process.env.SENTRY_DSN ?? '',
        SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || (ctx.dev ? 'development' : 'production'),
        SENTRY_RELEASE: sentryRelease,
        // Both default to 0, which is not just "don't sample" but "don't ship": the
        // integrations they gate are dead code at 0 and never enter the bundle.
        SENTRY_TRACES_SAMPLE_RATE: clamp01(process.env.SENTRY_TRACES_SAMPLE_RATE),
        SENTRY_REPLAY_SESSION_SAMPLE_RATE: clamp01(process.env.SENTRY_REPLAY_SESSION_SAMPLE_RATE),
        SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE: clamp01(process.env.SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE),
      },

      typescript: {
        strict: true,
        vueShim: true,
        extendTsConfig(tsConfig) {
          tsConfig.exclude!.push('./../functions');
          tsConfig.compilerOptions!.allowImportingTsExtensions = true;
          tsConfig.compilerOptions!.exactOptionalPropertyTypes = false;
        },
      },

      vueRouterMode: 'history', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,

      // Must stay `true`. @quasar/app-vite v3 defaults this to `false`, which sets
      // __VUE_OPTIONS_API__=false and strips Options API support (mixins / `inject:` /
      // `methods:`) from the build. Every `ais-*` component in vue-instantsearch is Options
      // API, and the flag only takes effect on the client — the server keeps rendering them
      // fine — so with this off `LegislationPage.vue` server-renders correctly and then
      // throws "this.suit is not a function" during hydration, wiping the SSR markup and
      // leaving a blank page. That blanks both /legislation and /manage/legislation, since
      // ManageLegislationPage is `<LegislationPage manage />`.
      // Our own components are all `<script setup>`; this is purely for vue-instantsearch.
      vueOptionsAPI: true,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      publicPath: '/',
      // analyze: true,
      // env: {},
      // rawDefine: {}
      // ignorePublicFolder: true,
      // Must stay a boolean: @quasar/app-vite v3 forwards this value verbatim into
      // the Rolldown config for the SSR webserver bundle, which only accepts
      // boolean | 'dce-only' | object — 'terser'/'oxc' make that build throw.
      // `true` uses Vite 8's oxc minifier, which drops comments by default.
      minify: true,
      // Only ever 'hidden' (maps emitted, no sourceMappingURL comment) and only while
      // uploading: @sentry/vite-plugin stamps debug IDs into the bundles, ships the maps
      // to Sentry and then deletes them from dist/, so traces de-minify in Sentry without
      // the maps being reachable from the browser.
      sourcemap: uploadSourcemaps ? ('hidden' as const) : false,
      // polyfillModulePreload: true,
      // distDir

      extendViteConf(viteConf) {
        // SSR
        if ((ctx.mode as any).ssr) {
          viteConf.build!.assetsDir = 'ssr-assets';
        }

        // Injected here rather than through build.vitePlugins because sentryVitePlugin()
        // returns an *array* of plugins, which Quasar's vitePlugins parser has no form for
        // (it would deep-merge the array into an object). Running for every Vite build in
        // the mode means the SPA chunks, the SSR client chunks and the server render
        // bundle all get their maps uploaded under the same release.
        if (uploadSourcemaps) {
          viteConf.plugins = [
            ...(viteConf.plugins ?? []),
            ...sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
              sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.js.map'] },
              telemetry: false,
            }),
          ];
        }
        viteConf.build!.rollupOptions = {
          ...viteConf.build!.rollupOptions,
          output: {
            ...viteConf.build!.rollupOptions?.output,
            manualChunks(id) {
              // Only apply manualChunks for client build
              if (viteConf.build!.ssr) {
                return;
              }

              // Firebase SDK
              if (id.includes('node_modules/firebase/')) {
                return 'vendor-firebase';
              }
              if (id.includes('node_modules/@firebase/')) {
                return 'vendor-firebase-internal';
              }
              // Quasar framework internals
              if (id.includes('node_modules/quasar/') || id.includes('node_modules/@quasar/')) {
                return 'vendor-quasar';
              }
              // Diff / text-comparison libraries (used in legislation diff view)
              if (id.includes('node_modules/diff-match-patch/') || id.includes('node_modules/diff/') || id.includes('node_modules/fast-diff/')) {
                return 'vendor-diff';
              }
              // Drag-and-drop
              if (id.includes('node_modules/vue-draggable-plus/') || id.includes('node_modules/sortablejs/')) {
                return 'vendor-draggable';
              }
              // Algolia search
              if (id.includes('node_modules/algoliasearch/') || id.includes('node_modules/@algolia/')) {
                return 'vendor-algolia';
              }
              // Vue ecosystem (vue, vue-router, pinia, vuefire)
              if (
                id.includes('node_modules/vue/') ||
                id.includes('node_modules/vue-router/') ||
                id.includes('node_modules/pinia/') ||
                id.includes('node_modules/vuefire/') ||
                id.includes('node_modules/@vueuse/')
              ) {
                return 'vendor-vue';
              }
            },
          },
        };
      },
      // viteVuePluginOptions: {},

      vitePlugins: [
        [
          'vite-plugin-checker',
          {
            vueTsc: true,
          },
          { server: false },
        ],
        [
          'vite-plugin-eslint2',
          {
            lintInWorker: true,
            lintOnStart: true,
            include: ['src/**/*.{ts,js,mjs,cjs,vue}', 'quasar.config.ts', 'eslint.config.js'],
          },
          { server: true, client: false },
        ],
      ],
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#devserver
    devServer: {
      // https: true,
      open: false, // opens browser window automatically
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#framework
    framework: {
      config: {},

      // iconSet: 'material-icons', // Quasar icon set
      lang: 'zh-TW', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: ['Dialog', 'Notify', 'Dark', 'LocalStorage', 'Loading', 'Screen', 'Meta'],
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   pwaRegisterServiceWorker: 'src-pwa/register-service-worker',
    //   pwaServiceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    //   bexManifestFile: 'src-bex/manifest.json
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      prodPort: 8080, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render', // keep this as last one
      ],

      // extendPackageJson (json) {},
      // extendSSRWebserverConf (esbuildConf) {},

      // manualStoreSerialization: true,
      // manualStoreSsrContextInjection: true,
      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      pwa: false,
      // pwaOfflineHtmlFilename: 'offline.html', // do NOT use index.html as name!

      // pwaExtendGenerateSWOptions (cfg) {},
      // pwaExtendInjectManifestOptions (cfg) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'GenerateSW', // 'GenerateSW' or 'InjectManifest'
      // swFilename: 'sw.js',
      // manifestFilename: 'manifest.json',
      // extendManifestJson (json) {},
      // useCredentialsForManifestTag: true,
      // injectPwaMetaTags: false,
      // extendPWACustomSWConf (esbuildConf) {},
      // extendGenerateSWOptions (cfg) {},
      // extendInjectManifestOptions (cfg) {}
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf) {},
      // extendElectronPreloadConf (esbuildConf) {},

      // extendPackageJson (json) {},

      // Electron preload scripts (if any) from /src-electron, WITHOUT file extension
      preloadScripts: ['electron-preload'],

      // specify the debugging port to use for the Electron app when running in development mode
      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: 'cksc-legislation',
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      // extendBexScriptsConf (esbuildConf) {},
      // extendBexManifestJson (json) {},

      /**
       * The list of extra scripts (js/ts) not in your bex manifest that you want to
       * compile and use in your browser extension. Maybe dynamic use them?
       *
       * Each entry in the list should be a relative filename to /src-bex/
       *
       * @example [ 'my-script.ts', 'sub-folder/my-other-script.js' ]
       */
      extraScripts: [],
    },
  };
});
