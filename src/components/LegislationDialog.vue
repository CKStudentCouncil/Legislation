<template>
  <q-dialog :model-value="action != null" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新建' }}法案</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="parentValue.name" label="法案名稱" />
        <q-input v-model="parentValue.preface" label="序言" />
        <q-select
          v-model="parentValue.category"
          :option-label="(o) => o.translation"
          :options="Object.values(LegislationCategory.VALUES)"
          label="法案類別"
        />
        <div class="q-pt-md q-pb-sm">立法日期：</div>
        <q-date v-model="parentValue.createdAt" mask="YYYY-MM-DD" />
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
import { computed } from 'vue';

const props = defineProps<{
  action: 'edit' | 'add' | null;
  modelValue: { name: string; category: LegislationCategory; createdAt: string; preface?: string };
}>();
const emits = defineEmits({
  submit: null,
  canceled: null,
  'update:modelValue': null,
});

const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emits('update:modelValue', val);
  },
});
</script>

<style scoped></style>
