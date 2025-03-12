<template>
  <div>
    <div v-if="$props.content.type.firebase == ContentType.Clause.firebase">
      <div v-if="$props.content.deleted" class="text-bold text-strike">
        {{ $props.content.title }}<span style="font-weight: normal"> (刪除)</span>
      </div>
      <div v-else>
        <div class="text-bold">
          {{ $props.content.title }} <span v-if="$props.content.subtitle.length > 0">【{{ $props.content.subtitle }}】</span>
          <q-btn class="no-print" dense flat icon="link" size="12px" @click="copyLink($props.content.index.toString())"></q-btn>
        </div>
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
    </div>
    <div v-if="$props.content.type.firebase == ContentType.SpecialClause.firebase">
      <q-expansion-item
        v-if="!printing"
        :model-value="expanded"
        default-opened
        dense
        dense-toggle
        switch-toggle-side
        @update:model-value="(v) => $emit('update:expanded', v)"
      >
        <template v-slot:header>
          <div v-if="$props.content.deleted" class="text-bold text-strike">
            {{ $props.content.title }}<span style="font-weight: normal"> (刪除)</span>
          </div>
          <div v-else>
            <div class="text-bold">
              {{ $props.content.title }} <span v-if="$props.content.subtitle.length > 0">【{{ $props.content.subtitle }}】</span>
              <q-btn class="no-print" dense flat icon="link" size="12px" @click="copyLink($props.content.index.toString())"></q-btn>
            </div>
          </div>
        </template>
        <p v-if="!$props.content.deleted" style="white-space: break-spaces">{{ $props.content.content }}</p>
      </q-expansion-item>
      <div v-else>
        <div v-if="$props.content.deleted" class="text-bold text-strike">
          {{ $props.content.title }}<span style="font-weight: normal"> (刪除)</span>
        </div>
        <div v-else>
          <div class="text-bold">
            {{ $props.content.title }} <span v-if="$props.content.subtitle.length > 0">【{{ $props.content.subtitle }}】</span>
            <q-btn class="no-print" dense flat icon="link" size="12px" @click="copyLink($props.content.index.toString())"></q-btn>
          </div>
          <p style="white-space: break-spaces">{{ $props.content.content }}</p>
        </div>
      </div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Volume.firebase">
      <div class="text-h4 text-bold" style="line-height: 65px">
        {{ $props.content.title }} {{ $props.content.subtitle }}
        <q-btn class="no-print" dense flat icon="link" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Chapter.firebase">
      <div class="text-h5 text-bold" style="line-height: 65px">
        {{ $props.content.title }} {{ $props.content.subtitle }}
        <q-btn class="no-print" dense flat icon="link" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Section.firebase">
      <div class="text-h6 text-bold" style="line-height: 45px">
        {{ $props.content.title }} {{ $props.content.subtitle }}
        <q-btn class="no-print" dense flat icon="link" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Subsection.firebase">
      <div class="text-h6 text-bold" style="line-height: 30px">
        {{ $props.content.title }} {{ $props.content.subtitle }}
        <q-btn class="no-print" dense flat icon="link" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { LegislationContent } from 'src/ts/models.ts';
import { ContentType } from 'src/ts/models.ts';
import type { PropType } from 'vue';
import { computed } from 'vue';
import { copyLink } from 'src/ts/utils.ts';

const props = defineProps({
  content: {
    type: Object as PropType<LegislationContent>,
    required: true,
  },
  printing: {
    type: Boolean,
    default: false,
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
const cleanLines = computed(() => props.content.content!.split('\n').filter((line) => line.match(/^[(]?（?[一二三四五六七八九十]*([）)、])/) == null));
</script>

<style scoped></style>
