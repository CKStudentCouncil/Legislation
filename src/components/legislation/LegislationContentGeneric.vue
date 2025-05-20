<template>
  <div>
    {{ $props.content.title }} {{ $props.content.subtitle }}
    <q-no-ssr>
      <q-btn aria-label="複製連結" class="no-print" dense flat icon="link" size="12px" @click="copyLink($props.content.index)" />
    </q-no-ssr>
  </div>
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
});
</script>

<style scoped></style>
