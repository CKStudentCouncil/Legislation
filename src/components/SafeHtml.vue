<template>
  <div v-html="sanitized" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { customSanitize } from 'src/ts/sanitize';

const props = defineProps<{
  content: string;
}>();

// Sanitize synchronously so the content is present in the SSR-rendered HTML.
// (Previously an async watch left `sanitized` empty during the server render pass,
//  so document bodies were missing from the HTML crawlers and answer engines see.)
const sanitized = computed(() => (props.content ? customSanitize(props.content) : ''));
</script>
