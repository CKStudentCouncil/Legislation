<template>
  <div id="mainframe" class="auto-dark">
    <router-view />
  </div>
</template>

<script lang="ts" setup>
import { Dark, LocalStorage, useMeta, useQuasar } from 'quasar';
import { onMounted, useSSRContext } from 'vue';
import { getMeta } from 'src/ts/utils.ts';

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
useMeta({
  title: 'null',
  titleTemplate: (title) => `${title !== 'null' ? title + ' - ' : ''}建國中學班聯會法律與公文系統`,
  meta: getMeta(undefined, undefined)
});
</script>
