<template>
  <q-tabs align="left">
    <q-route-tab label="文書查詢" to="/document/judicial" />
    <q-route-tab label="訴訟查詢" to="/document/judicial/lawsuit" />
  </q-tabs>

  <q-page padding>
    <q-stepper ref="stepper" v-model="step" animated header-nav>
      <q-step :done="!!findBy" :name="0" class="justify-center row" icon="list" title="選擇檢索模式">
        <q-btn class="row text-h6 q-mb-md" icon="menu" label="依屆次列出所有啟字公文選擇" @click="chooseFindBy('select')" />
        <q-btn class="row text-h6" icon="search" label="依訴訟案件號查詢" @click="chooseFindBy('id')" />
      </q-step>

      <q-step v-if="findBy === 'select'" :done="step === 2" :error="!reignValid" :name="1" icon="menu" title="輸入屆次">
        <q-input ref="reignInput" v-model="reign" :label="`屆次 (例：${getCurrentReign()})`" :rules="[isReign]" autofocus @keyup.enter="next" />
      </q-step>

      <q-step v-if="findBy === 'select'" :header-nav="false" :name="2" class="text-center" icon="checklist" title="選擇啟字公文">
        <q-spinner v-if="!q" color="primary" size="40px" />
        <q-list v-else bordered separator>
          <q-item
            v-for="doc of sortedOptions"
            :key="doc.idNumber"
            v-ripple
            :to="`/document/judicial/lawsuit/${doc.getFullId()}`"
            clickable
          >
            <q-item-section>
              <q-item-label class="text-h6" overline>{{ doc.getFullId() }}</q-item-label>
              <q-item-label class="text-h6">{{ doc.subject }}</q-item-label>
              <q-item-label caption
                >{{ htmlToText(doc.content).slice(0, 100) }}<span v-if="htmlToText(doc.content).length > 100">...</span>
              </q-item-label>
            </q-item-section>
          </q-item>
          <div v-if="sortedOptions.length === 0">查無啟字公文，請確認屆期正確</div>
        </q-list>
      </q-step>

      <q-step v-if="findBy === 'id'" :name="3" icon="search" title="輸入案件號">
        <q-select v-model="courtType" :options="courtTypeOptions" label="法庭類型" />

        <q-select
          v-if="courtType === '憲章法庭'"
          v-model="idPrefix"
          :options="constitutionalPrefixOptions"
          label="案件號字首"
          class="q-mt-md"
        />

        <template v-if="courtType === '一般法庭'">
          <q-select
            v-model="generalCaseType"
            :options="generalCaseTypeOptions"
            label="訴訟案件類型"
            class="q-mt-md"
          />
          <q-select
            v-if="generalCaseType"
            v-model="idPrefix"
            :options="generalPrefixOptions"
            label="案件號字首"
            class="q-mt-md"
          />
        </template>

        <q-input v-model="idNumber" label="案件號" class="q-mt-md" />

        <div class="text-h6 q-mt-sm">{{ idPrefix }}第{{ idNumber }}號</div>
      </q-step>

      <template v-slot:navigation>
        <q-stepper-navigation v-if="step > 0" align="right">
          <q-btn v-if="step !== 2" :label="step === 3 ? '查詢' : '下一步'" color="primary" @click="next" />
          <q-btn class="q-ml-sm" color="primary" flat label="返回" @click="previous" />
        </q-stepper-navigation>
      </template>
    </q-stepper>
  </q-page>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { getCurrentReign, getMeta, htmlToText } from 'src/ts/utils.ts';
import { isReign } from 'src/ts/checks.ts';
import * as models from 'src/ts/models.ts';
import { DocumentConfidentiality, documentsCollection } from 'src/ts/models.ts';
import { query, where } from 'firebase/firestore';
import { useCollection } from 'vuefire';
import orderBy from 'lodash/orderBy';
import { useRouter } from 'vue-router';
import { useMeta } from 'quasar';

const step = ref(0);
const stepper = ref();
const findBy = ref<null | 'select' | 'id'>(null);
const reign = ref<null | string>(null);
const reignInput = ref();
const reignValid = computed(() => reignInput.value?.hasError === false || step.value === 2);
const q = ref<any>(null);
const options = useCollection(q);
const sortedOptions = computed(() => orderBy(options.value, ['idNumber'], ['asc']));

const courtTypeOptions = ['憲章法庭', '一般法庭'];
const constitutionalPrefixOptions = ['憲字', '憲更字', '憲大字', '審大字', '憲大更字', '審大更字'];
const generalCaseTypeOptions = [
  '行政訴訟案件',
  '職務訴訟案件',
  '賠償訴訟案件',
  '確認訴訟案件',
  '選舉無效訴訟案件',
  '其他訴訟案件',
];

const generalCasePrefixMap: Record<string, string[]> = {
  行政訴訟案件: ['政字', '政更字', '政上字', '政大字', '政大更字'],
  職務訴訟案件: ['職字', '職更字', '職上字', '職大字', '職大更字'],
  賠償訴訟案件: ['償字', '償更字', '償上字', '償大字', '償大更字'],
  確認訴訟案件: ['確字', '確更字', '確上字', '確大字', '確大更字'],
  選舉無效訴訟案件: ['選字', '選更字', '選上字', '選大字', '選大更字'],
  其他訴訟案件: ['訴字', '訴更字', '訴上字', '訴大字', '訴大更字'],
};

const courtType = ref<'憲章法庭' | '一般法庭' | null>(null);
const generalCaseType = ref<string | null>(null);
const idPrefix = ref('');
const idNumber = ref();
const router = useRouter();

const generalPrefixOptions = computed(() => {
  if (!generalCaseType.value) return [];
  return generalCasePrefixMap[generalCaseType.value] || [];
});

watch(courtType, (newValue) => {
  idPrefix.value = '';
  generalCaseType.value = null;

  if (newValue === '憲章法庭') {
    idPrefix.value = constitutionalPrefixOptions[0];
  }
});

watch(generalCaseType, (newValue) => {
  idPrefix.value = '';
  if (newValue && generalCasePrefixMap[newValue]?.length) {
    idPrefix.value = generalCasePrefixMap[newValue][0];
  }
});

useMeta({ title: '訴訟檢索', meta: getMeta('訴訟檢索') });

function chooseFindBy(type: 'select' | 'id') {
  findBy.value = type;
  step.value = type === 'select' ? 1 : 3;
}

function next() {
  switch (step.value) {
    case 1:
      reignInput.value.validate();
      if (reignInput.value.hasError) return;
      loadOptions();
      break;
    case 3:
      void router.push(`/document/judicial/lawsuit/${idPrefix.value}第${idNumber.value}號`); //TODO check if doc exists before redirecting
  }
  stepper.value.next();
}

function previous() {
  q.value = null;
  stepper.value.previous();
}

function loadOptions() {
  if (!reign.value) {
    previous();
    return;
  }
  q.value = query(
    documentsCollection(),
    where('reign', '==', reign.value),
    where('type', '==', models.DocumentType.CourtProsecutions.firebase),
    where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
    where('published', '==', true),
  );
}
</script>

<style scoped></style>
