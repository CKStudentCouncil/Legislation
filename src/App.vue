<template>
  <div id="mainframe" class="auto-dark">
    <router-view />
  </div>
</template>

<script lang="ts" setup>
import { Dark, LocalStorage, useMeta, useQuasar } from 'quasar';
import { onMounted, useSSRContext } from 'vue';
import { useRoute } from 'vue-router';
import { getMeta } from 'src/ts/utils.ts';
import { SITE } from 'src/ts/structured-data.ts';

defineOptions({
  name: 'App',
});
if (process.env.SERVER) {
  const ssrContext = useSSRContext();
  const $q = useQuasar();
  if (ssrContext?.req.headers['sec-ch-prefers-color-scheme'] === 'dark') {
    $q.dark.set(true);
  } else if (ssrContext?.req.headers['sec-ch-prefers-color-scheme'] === 'light') {
    $q.dark.set(false);
  }
}
onMounted(() => {
  if (LocalStorage.has('dark')) {
    if (LocalStorage.getItem<boolean>('dark')) {
      Dark.set(true);
    } else {
      Dark.set(false);
      document.querySelector('#mainframe')?.classList.remove('auto-dark');
    }
  } else {
    Dark.set('auto');
  }
});
const route = useRoute();
useMeta(() => {
  // Self-referencing canonical + og:url, built from an absolute hard-coded base.
  // Never use window.location (undefined in SSR) or the request host (Cloud Run sees
  // an internal host behind Firebase Hosting). route.path excludes ?c= / #hash, so
  // clause-targeted legislation canonicalizes to its base URL.
  const canonical = SITE + route.path;
  return {
    title: 'null',
    titleTemplate: (title) => `${title !== 'null' ? title + ' - ' : ''}建國中學班聯會法律與公文系統`,
    htmlAttr: { lang: 'zh-Hant-TW' },
    meta: {
      ...getMeta(undefined, undefined),
      ogType: { property: 'og:type', content: 'website' },
      ogLocale: { property: 'og:locale', content: 'zh_TW' },
      ogUrl: { property: 'og:url', content: canonical },
    },
    link: {
      canonical: { rel: 'canonical', href: canonical },
    },
  };
});
</script>
