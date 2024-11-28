<template>
  <router-view />
</template>

<script lang="ts" setup>
import { Dark, LocalStorage, useMeta } from 'quasar';
import { useRoute } from 'vue-router';

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

const route = useRoute();
if (route.path.includes('/document/')) {
  console.log('ok')
  useMeta({
    meta: {
      description: {
        name: 'description',
        content: route.params.id,
      },
    },
  });
}
</script>
