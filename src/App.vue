<template>
  <router-view />
</template>

<script lang="ts" setup>
import { Dark, LocalStorage } from 'quasar';

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
</script>
