<template>
  <div v-if="$props.content.deleted" class="text-bold text-strike">{{ $props.content.title }}<span style="font-weight: normal"> (刪除)</span></div>
  <div v-else :class="$props.content.frozenBy ? 'bg-highlight' : ''">
    <div v-if="$props.content.frozenBy">
      <q-icon class="on-left" name="warning" />
      下列條文部分或全文已遭凍結或失效，詳見
      <q-btn :href="$props.content.frozenBy" dense icon="link" label="相關連結" target="_blank" />
    </div>
    <div>
      <div class="text-bold">
        {{ $props.content.title }} <span v-if="$props.content.subtitle.length > 0">【{{ $props.content.subtitle }}】</span>
        <q-btn class="no-print" dense flat icon="link" size="12px" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
      <div v-if="showContent">
        <div v-if="countLines">
          <div v-for="[index, line] of lines.entries()" :key="index" class="row">
            <p class="q-mb-sm">
              <span
                :style="line.match(/^[(]?（?[一二三四五六七八九十]*([）)、])/) || cleanLines.length <= 1 ? 'visibility: hidden' : ''"
                class="q-mr-sm text-secondary text-italic"
              >
                {{ cleanLines.indexOf(line) + 1 }}
              </span>
              {{ line }}
            </p>
          </div>
        </div>
        <div v-else>
          {{ $props.content.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { PropType } from 'vue';
import { computed } from 'vue';
import type { LegislationContent } from 'src/ts/models.ts';
import { copyLink } from 'src/ts/utils.ts';

const props = defineProps({
  content: {
    type: Object as PropType<LegislationContent>,
    required: true,
  },
  showContent: {
    type: Boolean,
    default: true,
  },
  countLines: {
    type: Boolean,
    default: true,
  },
  expanded: {
    type: Boolean,
    default: true,
  },
});
defineEmits({
  'update:expanded': (value: boolean) => true,
});

const lines = computed(() => props.content.content!.split('\n'));
const cleanLines = computed(() =>
  props.content.content!.split('\n').filter((line) => line.match(/^[(]?（?[一二三四五六七八九十]*([）)、])/) == null),
);
</script>

<style scoped>
.bg-highlight {
  background-color: #f2c03730;
}
</style>
