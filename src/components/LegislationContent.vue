<template>
  <div>
    <div v-if="$props.content.type.firebase == ContentType.Clause.firebase">
      <div v-if="$props.content.deleted" class="text-bold text-strike">
        {{ $props.content.title }}<span style="font-weight: normal"> (刪除)</span>
      </div>
      <div v-else>
        <div class="text-bold">
          {{ $props.content.title }} 【{{ $props.content.subtitle }}】
          <q-btn dense flat icon="link" size="12px" @click="copyLink($props.content.index.toString())"></q-btn>
        </div>
        <div v-for="[index, line] of lines.entries()" :key="index" class="row">
          <p class="q-mb-sm">
            <span :style="line.match(/^[一二三四五六七八九十][、 ]/) || (cleanLines.length <= 1) ? 'visibility: hidden' : ''" class="q-mr-sm text-secondary text-italic">
              {{ cleanLines.indexOf(line) + 1 }}
            </span>
            {{ line }}
          </p>
        </div>
      </div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Chapter.firebase">
      <div class="text-h5 text-bold" style="line-height: 65px">
        {{ $props.content.title }} {{ $props.content.subtitle }}
        <q-btn dense flat icon="link" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ContentType, LegislationContent } from 'src/ts/models.ts';
import { computed, PropType } from 'vue';
import { copyLink } from 'src/ts/utils.ts';

const props = defineProps({
  content: {
    type: Object as PropType<LegislationContent>,
    required: true,
  },
});

const lines = computed(() => props.content.content!.split('\n'));
const cleanLines = computed(() => props.content.content!.split('\n').filter((line) => line.match(/^[一二三四五六七八九十][、 ]/) == null));
</script>

<style scoped></style>
