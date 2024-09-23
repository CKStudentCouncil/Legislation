<template>
  <router-view />
</template>

<script setup lang="ts">
import { Dark, LocalStorage } from 'quasar';

defineOptions({
  name: 'App'
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
