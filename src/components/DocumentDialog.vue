<template>
  <q-dialog :model-value="action != null" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新建' }}公文</h6>
      </q-card-section>
      <q-card-section>
        <q-select v-model="parentValue.type" :option-label="(o) => o.translation" :options="Object.values(DocumentType.VALUES)" label="公文類別" :disable="action == 'edit'" />
        <q-input v-model="parentValue.subject" :label="isMeetingNotice || isMeetingRecord ? '會議名稱' : '主旨'" />
        <q-select
          v-model="parentValue.fromSpecific"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
          :label="isMeetingRecord ? '會議主席' : '發文者'"
        />
        <q-input
          v-if="parentValue.type.firebase==DocumentType.Order.firebase || isMeetingRecord"
          v-model="parentValue.fromName"
          :label="isMeetingRecord ? '會議主席姓名': '發文者姓名'"
        />
        <div v-if="isMeetingRecord">
          <q-select
            v-model="parentValue.secretarySpecific"
            :option-label="(o) => o.translation"
            :options="Object.values(DocumentSpecificIdentity.VALUES)"
            label="會議紀錄"
          />
          <q-input
            v-model="parentValue.secretaryName"
            label="會議紀錄姓名"
          />
          <q-input
            v-model="parentValue.location"
            label="會議地點"
          />
        </div>
        <q-select
          v-if="parentValue.type.firebase!=DocumentType.Order.firebase&&!isMeetingRecord"
          v-model="parentValue.toSpecific"
          :label="`${isMeetingNotice ? '出席人' : '受文者'} (可多選)`"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
          multiple
          use-chips
        />
        <div v-if="parentValue.toSpecific.map((s) => s.firebase).includes(DocumentSpecificIdentity.Other.firebase)&&!isMeetingRecord">
          <div class="q-mt-sm q-mb-sm">其他{{ isMeetingNotice ? '出席人' : '受文者' }}</div>
          <ListEditor v-model="parentValue.toOther" />
        </div>
        <q-select
          v-if="parentValue.type.firebase!=DocumentType.Order.firebase&&!isMeetingRecord"
          v-model="parentValue.ccSpecific"
          :label="`${isMeetingNotice ? '列席人' : '副本受文者'} (可多選)`"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
          multiple
          use-chips
        />
        <div v-if="parentValue.ccSpecific.map((s) => s.firebase).includes(DocumentSpecificIdentity.Other.firebase)&&!isMeetingRecord">
          <div class="q-mt-sm q-mb-sm">其他{{ isMeetingNotice ? '列席人' : '副本受文者' }}</div>
          <ListEditor v-model="parentValue.ccOther" />
        </div>
        <q-select
          v-if="parentValue.type.firebase!=DocumentType.Order.firebase&&!isMeetingRecord"
          v-model="parentValue.confidentiality"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentConfidentiality.VALUES)"
          label="密等"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="$emit('canceled')" />
        <q-btn color="positive" flat label="確定" @click="$emit('submit')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as models from '../ts/models';
import { DocumentConfidentiality, DocumentSpecificIdentity, DocumentType } from '../ts/models';
import ListEditor from 'components/ListEditor.vue';

const props = defineProps<{
  action: 'edit' | 'add' | null;
  modelValue: models.Document;
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

const isMeetingNotice = computed(() => parentValue.value.type.firebase == DocumentType.MeetingNotice.firebase);
const isMeetingRecord = computed(() => parentValue.value.type.firebase == DocumentType.Record.firebase);
</script>

<style scoped></style>
