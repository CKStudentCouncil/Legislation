<template>
  <q-dialog :model-value="action != null" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新建' }}公文</h6>
      </q-card-section>
      <q-card-section>
        <q-select v-model="parentValue.type" :disable="action == 'edit'" :option-label="(o) => o.translation" :options="types" label="公文類別" />
        <q-input v-model="parentValue.subject" :label="isMeetingNotice || isMeetingRecord ? '會議名稱' : '主旨'" />
        <q-input v-if="parentValue.type.firebase.startsWith('JudicialCommittee')" v-model="parentValue.idNumber" label="編號 (數字部分如：三 或 3)" />
        <q-select
          v-model="parentValue.fromSpecific"
          :label="isMeetingRecord ? '會議主席' : '發文者'"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
        />
        <q-input
          v-if="isOrder || isAnnouncement || isMeetingRecord || isMeetingNotice"
          v-model="parentValue.fromName"
          :label="isMeetingRecord || isMeetingNotice ? '會議主席姓名' : '發文者姓名'"
        />
        <div v-if="isMeetingRecord">
          <q-select
            v-model="parentValue.secretarySpecific"
            :option-label="(o) => o.translation"
            :options="Object.values(DocumentSpecificIdentity.VALUES)"
            label="會議紀錄"
          />
          <q-input v-model="parentValue.secretaryName" label="會議紀錄姓名" />
        </div>
        <div v-if="isMeetingRecord || isMeetingNotice">
          <div>會議時間</div>
          <div class="row q-gutter-sm">
            <q-date :model-value="meetingDate" class="col" mask="YYYY-MM-DD" @update:model-value="updateMeetingDate" />
            <q-time :model-value="meetingTime" class="col" format24h mask="HH:mm" @update:model-value="updateMeetingTime" />
          </div>
          <q-input v-model="parentValue.location" label="會議地點" />
        </div>
        <q-select
          v-if="!hideTo"
          v-model="parentValue.toSpecific"
          :label="`${isMeetingNotice ? '出席人' : '受文者'} (可多選)`"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
          multiple
          use-chips
        />
        <div v-if="parentValue.toSpecific.map((s) => s.firebase).includes(DocumentSpecificIdentity.Other.firebase) && !hideTo">
          <div class="q-mt-sm q-mb-sm">其他{{ isMeetingNotice ? '出席人' : '受文者' }}</div>
          <ListEditor v-model="parentValue.toOther" />
        </div>
        <q-select
          v-if="!hideTo"
          v-model="parentValue.ccSpecific"
          :label="`${isMeetingNotice ? '列席人' : '副本受文者'} (可多選)`"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
          multiple
          use-chips
        />
        <div v-if="parentValue.ccSpecific.map((s) => s.firebase).includes(DocumentSpecificIdentity.Other.firebase) && !hideTo">
          <div class="q-mt-sm q-mb-sm">其他{{ isMeetingNotice ? '列席人' : '副本受文者' }}</div>
          <ListEditor v-model="parentValue.ccOther" />
        </div>
        <q-select
          v-if="!hideConfidentiality"
          v-model="parentValue.confidentiality"
          :option-label="(o) => o.translation"
          :options="Object.values(DocumentConfidentiality.VALUES)"
          label="密等"
        />
        <q-input v-if="isJudicial&&!isProsecution" :model-value="parentValue.prosecutionId" label="啟訴書公文字號或連結" @update:model-value="updateProsecutionId" />
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
import { DocumentConfidentiality, DocumentGeneralIdentity, DocumentSpecificIdentity, DocumentType } from '../ts/models';
import ListEditor from 'components/ListEditor.vue';
import { date } from 'quasar';

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

const types = computed(() =>
  Object.values(models.DocumentType.VALUES).filter(
    (t) => parentValue.value.fromSpecific.generic.firebase === DocumentGeneralIdentity.JudicialCommittee.firebase || !t.judicialCommitteeOnly,
  ),
);

const hideTo = computed(
  () => isOrder.value || isAnnouncement.value || parentValue.value.type.firebase.startsWith('JudicialCommittee') || isMeetingRecord.value,
);
const hideConfidentiality = computed(
  () => isOrder.value || isAnnouncement.value || parentValue.value.type.firebase.startsWith('JudicialCommittee') || isMeetingRecord.value,
);
const isMeetingNotice = computed(() => parentValue.value.type.firebase == DocumentType.MeetingNotice.firebase);
const isMeetingRecord = computed(() => parentValue.value.type.firebase == DocumentType.Record.firebase);
const isOrder = computed(() => parentValue.value.type.firebase == DocumentType.Order.firebase);
const isAnnouncement = computed(() => parentValue.value.type.firebase == DocumentType.Announcement.firebase);
const isJudicial = computed(() => parentValue.value.type.judicialCommitteeOnly);
const isProsecution = computed(() => parentValue.value.type.firebase == DocumentType.CourtProsecutions.firebase);
//TODO: fix/why doesn't the date selector update while the data does?
const meetingDate = computed(() => date.formatDate(parentValue.value.meetingTime ?? new Date(), 'YYYY-MM-DD'));
const meetingTime = computed(() => date.formatDate(parentValue.value.meetingTime ?? new Date(), 'HH:mm'));

function updateMeetingDate(dt: string) {
  const d = dt.split('-');
  if (parentValue.value.meetingTime == null || d.length < 3) {
    parentValue.value.meetingTime = new Date();
  }
  parentValue.value.meetingTime?.setFullYear(parseInt(d[0]!), parseInt(d[1]!) - 1, parseInt(d[2]!));
}

function updateMeetingTime(tm: string | null) {
  if (tm == null) return;
  const t = tm.split(':');
  if (parentValue.value.meetingTime == null || t.length < 2) {
    parentValue.value.meetingTime = new Date();
  }
  parentValue.value.meetingTime?.setHours(parseInt(t[0]!), parseInt(t[1]!), 0);
}

function updateProsecutionId(id: any) {
  if (typeof id !== 'string') return;
  if (id.startsWith('http')) {
    const matches = decodeURI(id).match(/^.*\/document\/(.*)$/);
    if (matches == null || matches.length < 2) return;
    parentValue.value.prosecutionId = matches[1]?.trim();
  } else {
    parentValue.value.prosecutionId = id.trim();
  }
}
</script>

<style scoped></style>
