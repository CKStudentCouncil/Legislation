<template>
  <q-tabs align="left">
    <q-route-tab label="文書查詢" to="/document/judicial" />
    <q-route-tab label="訴訟查詢" to="/document/judicial/lawsuit" />
  </q-tabs>

  <q-page padding>
    <q-stepper ref="stepper" v-model="step" animated header-nav>
      <q-step :done="!!findBy" :name="0" class="justify-center row" icon="list" title="選擇檢索模式">
        <q-btn class="row text-h6 q-mb-md" icon="menu" label="依屆次列出所有啟訴書選擇" @click="chooseFindBy('select')" />
        <q-btn class="row text-h6" icon="search" label="依啟訴書字號查詢" @click="chooseFindBy('id')" />
      </q-step>

      <q-step v-if="findBy === 'select'" :done="step === 2" :error="!reignValid" :name="1" icon="menu" title="輸入屆次">
        <q-input ref="reignInput" v-model="reign" :label="`屆次 (例：${getCurrentReign()})`" :rules="[isReign]" autofocus @keyup.enter="next" />
      </q-step>

      <q-step v-if="findBy === 'select'" :header-nav="false" :name="2" class="text-center" icon="checklist" title="選擇啟訴書">
        <q-spinner v-if="!q" color="primary" size="40px" />
        <q-list v-else bordered separator>
          <q-item
            v-for="doc of sortedOptions"
            :key="doc.idNumber"
            v-ripple
            :to="`/document/judicial/lawsuit/${doc.idPrefix}第${doc.idNumber}號`"
            clickable
          >
            <q-item-section>
              <q-item-label class="text-h6" overline>{{ doc.idPrefix }}第{{ doc.idNumber }}號</q-item-label>
              <q-item-label class="text-h6">{{ doc.subject }}</q-item-label>
              <q-item-label caption
                >{{ htmlToText(doc.content).slice(0, 100) }}<span v-if="htmlToText(doc.content).length > 100">...</span>
              </q-item-label>
            </q-item-section>
          </q-item>
          <div v-if="sortedOptions.length === 0">查無啟訴書，請確認屆期正確</div>
        </q-list>
      </q-step>

      <q-step v-if="findBy === 'id'" :name="3" icon="search" title="輸入啟訴書字號">
        <q-select v-model="idPrefix" :options="['憲啟字', '政啟字', '其他']" label="啟訴字首" />
        <q-input v-if="!['憲啟字', '政啟字'].includes(idPrefix)" v-model="idPrefix" label="啟訴字首" />
        <q-input v-model="idNumber" label="啟訴字號" />
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
import { computed, ref } from 'vue';
import { getCurrentReign, htmlToText } from 'src/ts/utils.ts';
import { isReign } from 'src/ts/checks.ts';
import * as models from 'src/ts/models.ts';
import { DocumentConfidentiality, documentsCollection } from 'src/ts/models.ts';
import { query, where } from 'firebase/firestore';
import { useCollection } from 'vuefire';
import orderBy from 'lodash/orderBy';
import { useRouter } from 'vue-router';

const step = ref(0);
const stepper = ref();
const findBy = ref<null | 'select' | 'id'>(null);
const reign = ref<null | string>(null);
const reignInput = ref();
const reignValid = computed(() => reignInput.value?.hasError === false || step.value === 2);
const q = ref<any>(null);
const options = useCollection(q);
const sortedOptions = computed(() => orderBy(options.value, ['idNumber'], ['asc']));
const idPrefix = ref('憲啟字');
const idNumber = ref();
const router = useRouter();

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
