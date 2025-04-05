<template>
  <router-view />
</template>

<script lang="ts" setup>
import { Dark, LocalStorage, useMeta } from 'quasar';

defineOptions({
  name: 'App',
});
if (LocalStorage.has('dark')) {
  if (LocalStorage.getItem<boolean>('dark')) {
    Dark.set(true);
  } else {
    Dark.set(false);
  }
} else {
  Dark.set('auto');
}
useMeta({
  title: '建國中學班聯會法律與公文系統',
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
    }
  },
});
</script>
