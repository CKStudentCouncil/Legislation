<template>
  <div>
    <div v-if="$props.content.type.firebase == ContentType.Clause.firebase">
      <LegislationContentClause :content="$props.content" />
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
          <LegislationContentClause :content="$props.content" :count-lines="false" :show-content="false" />
        </template>
        <p v-if="!$props.content.deleted" style="white-space: break-spaces">{{ $props.content.content }}</p>
      </q-expansion-item>
      <div v-else>
        <LegislationContentClause :content="$props.content" :count-lines="false" />
      </div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Volume.firebase">
      <div class="text-h4 text-bold" style="line-height: 65px">
        {{ $props.content.title }} {{ $props.content.subtitle }}
        <q-btn class="no-print" dense flat icon="link" @click="copyLink($props.content.index.toString())"></q-btn>
      </div>
      <div v-if="$props.content.content?.length ?? 0 > 0" class="text-h6 text-bold">{{ $props.content.content }}</div>
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
import LegislationContentClause from 'components/legislation/LegislationContentClause.vue';

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
const cleanLines = computed(() =>
  props.content.content!.split('\n').filter((line) => line.match(/^[(]?（?[一二三四五六七八九十]*([）)、])/) == null),
);
</script>

<style scoped>
</style>
