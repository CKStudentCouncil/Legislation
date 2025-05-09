<template>
  <q-dialog :model-value="action != null" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新建' }}法令</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="parentValue.name" label="法令名稱" />
        <q-input v-model="parentValue.preface" label="序言" />
        <q-select
          v-model="parentValue.category"
          :option-label="(o) => o.translation"
          :options="Object.values(LegislationCategory.VALUES)"
          label="法令類別"
        />
        <div class="q-pt-md q-pb-sm">立法日期：</div>
        <q-date v-model="parentValue.createdAt" mask="YYYY-MM-DD" />
        <br />
        <q-checkbox
          :model-value="!!parentValue.frozenBy"
          label="凍結或失效"
          @update:model-value="(v) => (v ? (parentValue.frozenBy = ' ') : (parentValue.frozenBy = undefined))"
        />
        <q-input v-if="parentValue.frozenBy" ref="frozenByRef" v-model="parentValue.frozenBy" :rules="[isUrl]" label="凍結或失效之依據公文" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="$emit('canceled')" />
        <q-btn color="positive" flat label="確定" @click="$emit('submit')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { LegislationCategory } from 'src/ts/models.ts';
import { computed, ref } from 'vue';
import { isUrl } from 'src/ts/checks.ts';

const props = defineProps<{
  action: 'edit' | 'add' | null;
  modelValue: { name: string; category: LegislationCategory; createdAt: string; preface?: string; frozenBy?: string };
}>();
const emits = defineEmits({
  submit: null,
  canceled: null,
  'update:modelValue': null,
});
const frozenByRef = ref();

const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emits('update:modelValue', val);
  },
});

function validate() {
  return frozenByRef.value.validate();
}

defineExpose({ validate });
</script>

<style scoped></style>
