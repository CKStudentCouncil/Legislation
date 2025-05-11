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
      <legislation-content-generic :content="content" class="text-h4 text-bold" style="line-height: 65px" />
      <div v-if="$props.content.content?.length ?? 0 > 0" class="text-h6 text-bold">{{ $props.content.content }}</div>
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Chapter.firebase">
      <legislation-content-generic :content="content" class="text-h5 text-bold" style="line-height: 65px" />
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Section.firebase">
      <legislation-content-generic :content="content" class="text-h6 text-bold" style="line-height: 45px" />
    </div>
    <div v-if="$props.content.type.firebase == ContentType.Subsection.firebase">
      <legislation-content-generic :content="content" class="text-h6 text-bold" style="line-height: 30px" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { LegislationContent } from 'src/ts/models.ts';
import { ContentType } from 'src/ts/models.ts';
import type { PropType } from 'vue';
import LegislationContentClause from 'components/legislation/LegislationContentClause.vue';
import LegislationContentGeneric from 'components/legislation/LegislationContentGeneric.vue';

defineProps({
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
</script>

<style scoped></style>
