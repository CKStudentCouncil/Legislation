<template>
  <div :class="$q.dark.isActive ? 'auto-dark' : ''" id="mainframe">
    <router-view />
  </div>
</template>

<script lang="ts" setup>
import { Dark, LocalStorage, useMeta, useQuasar } from 'quasar';
import { ref, useSSRContext } from 'vue';

defineOptions({
  name: 'App',
});
const mainframe = ref();
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
if (process.env.SERVER) {
  const ssrContext = useSSRContext();
  const $q = useQuasar();
  if (ssrContext?.req.headers['sec-ch-prefers-color-scheme'] === 'dark') {
    $q.dark.set(true);
  } else if (ssrContext?.req.headers['sec-ch-prefers-color-scheme'] === 'light') {
    $q.dark.set(false);
  }
}
useMeta({
  title: 'null',
  titleTemplate: (title) => `${title !== 'null' ? title + ' - ' : ''}建國中學班聯會法律與公文系統`,
  meta: {
    description: {
      name: 'description',
      content: 'A platform for organizing and displaying laws, orders and documents of the student council of CKHS',
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
