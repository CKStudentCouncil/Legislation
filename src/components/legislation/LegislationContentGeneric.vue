<template>
  <component :is="headingTag">
    {{ $props.content.title }} {{ $props.content.subtitle }}
    <q-no-ssr>
      <q-btn aria-label="複製連結" class="no-print" dense flat icon="link" size="12px" @click="copyLink($props.content.index)" />
    </q-no-ssr>
  </component>
</template>

<script lang="ts" setup>
import { copyLink } from 'src/ts/utils.ts';
import type { PropType } from 'vue';
import type { LegislationContent } from 'src/ts/models.ts';

defineProps({
  content: {
    type: Object as PropType<LegislationContent>,
    required: true,
  },
  // Semantic heading element for the document outline (Volume→h2 … Subsection→h5).
  // Styling comes from the text-h* class passed by the parent, so this is visually identical.
  headingTag: {
    type: String,
    default: 'div',
  },
});
</script>

<style scoped>
h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0;
}
</style>
