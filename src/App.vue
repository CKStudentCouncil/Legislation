<template>
  <div id="mainframe" :class="$q.dark.isActive ? 'auto-dark' : ''">
    <router-view />
  </div>
</template>

<script lang="ts" setup>
import { Dark, LocalStorage, useMeta, useQuasar } from 'quasar';
import { onMounted, useSSRContext } from 'vue';

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
  meta: {
    description: {
      name: 'description',
      content: '建國中學班聯會內憲章、法律、命令、公文之中央儲存資料庫',
    },
    ogImage: {
      name: 'og:image',
      content: 'https://raw.githubusercontent.com/CKStudentCouncil/Legislation/refs/heads/main/mail/images/_1.png',
    },
    ogImageWidth: {
      name: 'og:image:width',
      content: '1920',
    },
    ogImageHeight: {
      name: 'og:image:height',
      content: '640',
    },
    twitterImage: {
      name: 'twitter:image',
      content: 'https://raw.githubusercontent.com/CKStudentCouncil/Legislation/refs/heads/main/mail/images/_1.png',
    },
  },
});
</script>
