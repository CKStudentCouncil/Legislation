<template>
  <div v-if="renderLines">
    <div v-for="(line, index) of renderedLines" :key="index" class="row">
      <p class="q-mb-sm q-mt-none diff-p" style="white-space: break-spaces">
        <span
          :style="isLineHidden(line.text) || cleanLinesText.length <= 1 ? 'visibility: hidden' : ''"
          class="q-mr-sm text-secondary text-italic diff-line-number"
        >
          {{ getLineNumber(line.text) }}
        </span>
        <template v-for="(part, i) in line.parts" :key="i">
          <del v-if="part.removed" class="diff-removed">{{ part.value }}</del>
          <ins v-else-if="part.added" class="diff-added">{{ part.value }}</ins>
          <span v-else>{{ part.value }}</span>
        </template>
      </p>
    </div>
  </div>
  <span v-else class="inline-diff" style="white-space: break-spaces">
    <template v-for="(part, i) in diffs" :key="i">
      <del v-if="part.removed" class="diff-removed">{{ part.value }}</del>
      <ins v-else-if="part.added" class="diff-added">{{ part.value }}</ins>
      <span v-else>{{ part.value }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { diffChars } from 'diff';

const props = defineProps<{
  oldString: string;
  newString: string;
  renderLines?: boolean;
}>();

const diffs = computed(() => {
  return diffChars(props.oldString || '', props.newString || '');
});

const renderedLines = computed(() => {
  const lines: { parts: any[]; text: string }[] = [];
  let currentParts: any[] = [];
  let currentText = '';

  for (const part of diffs.value) {
    const segments = (part.value || '').split('\n');
    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        lines.push({ parts: currentParts, text: currentText });
        currentParts = [];
        currentText = '';
      }
      const segment = segments[i];
      if (segment && segment.length > 0) {
        currentParts.push({ ...part, value: segment });
        if (!part.removed) {
          currentText += segment;
        }
      }
    }
  }
  if (currentParts.length > 0 || diffs.value.length === 0) {
    lines.push({ parts: currentParts, text: currentText });
  }
  return lines;
});

const cleanLinesText = computed(() => {
  return renderedLines.value.map((l) => l.text || '').filter((t) => t.match(/^[(]?（?[一二三四五六七八九十]*([）)、])/) == null);
});

function isLineHidden(text?: string) {
  return (text || '').match(/^[(]?（?[一二三四五六七八九十]*([）)、])/) != null;
}

function getLineNumber(text?: string) {
  const idx = cleanLinesText.value.indexOf(text || '');
  return idx >= 0 ? idx + 1 : '';
}
</script>

<style scoped>
.diff-added {
  color: red;
  text-decoration: underline;
}
.diff-removed {
  text-decoration: line-through;
  color: red;
}
@media print {
  .diff-line-number {
    color: black !important;
  }
}
</style>
