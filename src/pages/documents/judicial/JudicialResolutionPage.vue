<template>
  <q-tabs align="left">
    <q-route-tab label="文書查詢" to="/document/judicial" />
    <q-route-tab label="訴訟查詢" to="/document/judicial/lawsuit" />
    <q-route-tab label="決議文" to="/document/judicial/resolution" />
  </q-tabs>

  <q-page padding>
    <div class="text-h5 q-mb-md">決議文檢索</div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-3">
        <q-input
          v-model="idNumber"
          label="編號（例：1150308）"
          clearable
          debounce="400"
          @keyup.enter="applyFilters"
        />
      </div>

      <div class="col-12 col-md-3">
        <q-input
          v-model="subject"
          label="主旨"
          clearable
          debounce="400"
          @keyup.enter="applyFilters"
        />
      </div>

      <div class="col-12 col-md-3">
        <q-input
          v-model="keyword"
          label="關鍵字"
          clearable
          debounce="400"
          @keyup.enter="applyFilters"
        />
      </div>

      <div class="col-12 col-md-3">
        <q-input
          v-model="reign"
          label="屆次（例：80-2）"
          clearable
          debounce="400"
          @keyup.enter="applyFilters"
        />
      </div>
    </div>

    <div class="q-mb-lg">
      <q-btn color="primary" icon="search" label="搜尋" @click="applyFilters" />
      <q-btn class="q-ml-sm" flat color="primary" icon="clear" label="清除條件" @click="resetFilters" />
    </div>

    <div class="text-subtitle2 q-mb-md">
      共 {{ filteredDocs.length }} 筆決議文
    </div>

    <q-spinner v-if="loading" color="primary" size="40px" />

    <div v-else-if="filteredDocs.length === 0" class="text-grey-7">
      查無符合條件的決議文
    </div>

    <div v-else class="column q-gutter-md">
      <q-card v-for="doc of filteredDocs" :key="doc.getFullId()" bordered flat>
        <q-card-section>
          <div class="text-overline">{{ doc.getFullId() }}</div>
          <div class="text-h6">{{ doc.subject }}</div>
          <div class="text-caption text-grey-7 q-mt-xs">
            屆次：{{ doc.reign || '—' }}
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section>
          <div class="text-body2">
            {{ htmlToText(doc.content).slice(0, 120) }}
            <span v-if="htmlToText(doc.content).length > 120">...</span>
          </div>
        </q-card-section>

        <q-expansion-item
          icon="preview"
          label="預覽內容"
          expand-separator
        >
          <q-card flat>
            <q-card-section>
              <DocumentRenderer :doc="doc" />
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-separator />

        <q-card-actions align="right">
          <q-btn
            flat
            color="primary"
            icon="link"
            label="複製連結"
            @click="copyDocLink(doc)"
          />
          <q-btn
            flat
            color="primary"
            icon="open_in_new"
            label="檢視原文"
            :to="`/document/${doc.getFullId()}`"
            rel="link"
            :alt="`${doc.getFullId()}：${doc.subject}`"
          />
        </q-card-actions>
      </q-card>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { query, where } from 'firebase/firestore';
import { useCollection } from 'vuefire';
import orderBy from 'lodash/orderBy';
import { useMeta } from 'quasar';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { copyLink, getMeta, htmlToText } from 'src/ts/utils.ts';
import { DocumentConfidentiality, DocumentType, documentsCollection } from 'src/ts/models.ts';

const idNumber = ref('');
const subject = ref('');
const keyword = ref('');
const reign = ref('');

const appliedIdNumber = ref('');
const appliedSubject = ref('');
const appliedKeyword = ref('');
const appliedReign = ref('');

useMeta({ title: '決議文檢索', meta: getMeta('決議文檢索') });

const q = query(
  documentsCollection(),
  where('type', '==', DocumentType.JudicialDecision.firebase),
  where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
  where('published', '==', true),
);

const docs = useCollection(q);

const loading = computed(() => docs.value === undefined);

const sortedDocs = computed(() =>
  orderBy(docs.value || [], ['idNumber'], ['desc']),
);

const filteredDocs = computed(() => {
  let result = sortedDocs.value;

  if (appliedIdNumber.value.trim()) {
    const target = appliedIdNumber.value.trim().toLowerCase();
    result = result.filter((doc: any) => {
      const fullId = String(doc.getFullId?.() || '').toLowerCase();
      const rawIdNumber = String(doc.idNumber || '').toLowerCase();
      return fullId.includes(target) || rawIdNumber.includes(target);
    });
  }

  if (appliedSubject.value.trim()) {
    const target = appliedSubject.value.trim().toLowerCase();
    result = result.filter((doc: any) =>
      String(doc.subject || '').toLowerCase().includes(target),
    );
  }

  if (appliedKeyword.value.trim()) {
    const target = appliedKeyword.value.trim().toLowerCase();
    result = result.filter((doc: any) => {
      const text = htmlToText(String(doc.content || '')).toLowerCase();
      const sub = String(doc.subject || '').toLowerCase();
      return text.includes(target) || sub.includes(target);
    });
  }

  if (appliedReign.value.trim()) {
    const target = appliedReign.value.trim().toLowerCase();
    result = result.filter((doc: any) =>
      String(doc.reign || '').toLowerCase().includes(target),
    );
  }

  return result;
});

function applyFilters() {
  appliedIdNumber.value = idNumber.value;
  appliedSubject.value = subject.value;
  appliedKeyword.value = keyword.value;
  appliedReign.value = reign.value;
}

function resetFilters() {
  idNumber.value = '';
  subject.value = '';
  keyword.value = '';
  reign.value = '';

  appliedIdNumber.value = '';
  appliedSubject.value = '';
  appliedKeyword.value = '';
  appliedReign.value = '';
}

function copyDocLink(doc: any) {
  void copyLink(`/document/${doc.getFullId()}`);
}
</script>

<style scoped></style>
