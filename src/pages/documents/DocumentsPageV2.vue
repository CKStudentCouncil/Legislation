<template>
  <q-page padding>
    <q-no-ssr v-if="filters" :class="$q.screen.gt.xs ? 'row' : ''">
      <q-input v-model="reign" :label="`屆次 (例：${getCurrentReign()})`" :rules="[isReign]" class="col q-pr-sm" clearable debounce="500" />
      <q-input
        v-model="before"
        :disabled="published === false"
        :rules="[optionalDate]"
        class="col q-pr-sm"
        label="發文日期早於"
        mask="date"
        shadow-text="可按右旁按鈕選擇"
      >
        <template v-slot:append>
          <q-icon class="cursor-pointer" name="event">
            <q-popup-proxy cover transition-hide="scale" transition-show="scale">
              <q-date v-model="before">
                <div class="row items-center justify-end">
                  <q-btn v-close-popup color="primary" flat label="Close" />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
      <q-input
        v-model="after"
        :disabled="published === false"
        :rules="[optionalDate]"
        class="col q-pr-sm"
        label="發文日期晚於"
        mask="date"
        shadow-text="可按右旁按鈕選擇"
      >
        <template v-slot:append>
          <q-icon class="cursor-pointer" name="event">
            <q-popup-proxy cover transition-hide="scale" transition-show="scale">
              <q-date v-model="after">
                <div class="row items-center justify-end">
                  <q-btn v-close-popup color="primary" flat label="Close" />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
      <q-select
        v-model="type"
        :option-label="(i) => i.translation"
        :options="Object.values(DocumentType.VALUES)"
        class="col q-pr-sm"
        clearable
        label="公文類型"
      />
      <q-select
        v-model="fromGeneric"
        :option-label="(i) => i.translation"
        :options="Object.values(DocumentGeneralIdentity.VALUES)"
        class="col q-pr-sm"
        clearable
        label="發文部門"
      />
      <q-select
        v-model="fromSpecific"
        :option-label="(i) => i.translation"
        :options="Object.values(DocumentSpecificIdentity.VALUES).filter((i) => !fromGeneric || i.generic.firebase === fromGeneric.firebase)"
        class="col q-pr-sm"
        label="發文者"
        multiple
        use-chips
      />
      <q-select
        v-model="toGeneric"
        :option-label="(i) => i.translation"
        :options="Object.values(DocumentGeneralIdentity.VALUES)"
        class="col q-pr-sm"
        clearable
        label="受文部門"
      />
      <q-select
        v-model="toSpecific"
        :option-label="(i) => i.translation"
        :options="Object.values(DocumentSpecificIdentity.VALUES).filter((i) => !toGeneric || i.generic.firebase === toGeneric.firebase)"
        class="col q-pr-sm"
        label="受文者"
        multiple
        use-chips
      />
      <q-checkbox v-if="manage" v-model="published" class="col q-pr-sm" label="已發布" @update:model-value="choosePublished" />
    </q-no-ssr>
    <div class="text-grey-6">共 {{ totalDocs }} 件公文符合查詢條件</div>
    <q-infinite-scroll ref="scroll" :class="$q.screen.gt.sm ? 'row' : ''" @load="loadMore">
      <div v-for="doc of allDocs" :key="doc!.idPrefix + doc!.idNumber" :class="'q-mb-md q-pr-md ' + ($q.screen.gt.sm && dense ? 'col-6' : '')">
        <q-card :class="doc.published ? '' : 'bg-highlight'">
          <div v-if="!!doc">
            <q-card-section>
              <div>{{ doc.idPrefix }}第{{ doc.idNumber }}號</div>
              <div v-if="!doc.published" class="text-amber-9">
                <q-icon class="q-pr-sm" name="warning" />
                未發布
              </div>
              <div>{{ doc.publishedAt?.toLocaleDateString() }}</div>
              <div class="text-h6">{{ doc.subject }}</div>
            </q-card-section>
            <q-separator />
            <q-card-actions>
              <q-btn v-if="manage" :to="`/manage/document/${doc.idPrefix}第${doc.idNumber}號`" color="secondary" flat label="編輯" />
              <q-btn :to="`/document/${doc.idPrefix}第${doc.idNumber}號`" color="primary" flat icon="visibility" label="檢視" role="link" />
              <q-btn color="primary" flat icon="link" label="複製連結" @click="copyDocLink(`${doc.idPrefix}第${doc.idNumber}號`)" />
            </q-card-actions>
          </div>
        </q-card>
      </div>
      <template v-slot:loading>
        <div class="row justify-center q-my-md">
          <q-spinner-dots color="primary" size="40px" />
        </div>
      </template>
    </q-infinite-scroll>
  </q-page>
</template>

<script lang="ts" setup>
import { copyDocLink, getCurrentReign, notifyError } from 'src/ts/utils.ts';
import type { Ref } from 'vue';
import { computed, reactive, ref, watch } from 'vue';
import type { Document } from 'src/ts/models.ts';
import { DocumentConfidentiality, DocumentGeneralIdentity, documentsCollection, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';
import { getCountFromServer, getDocs, limit, orderBy, query, startAt, Timestamp, where } from 'firebase/firestore';
import { isReign, optionalDate } from 'src/ts/checks.ts';

const props = defineProps({
  manage: {
    type: Boolean,
    default: false,
  },
  dense: {
    type: Boolean,
    default: true,
  },
  filters: {
    type: Boolean,
    default: true,
  },
  filterType: {
    type: String,
    default: null,
  },
  filterReign: {
    type: String,
    default: null,
  },
});
const reign = ref(props.filters ? getCurrentReign() : null);
const fromGeneric = ref(null) as Ref<DocumentGeneralIdentity | null>;
const fromSpecific = ref([]) as Ref<DocumentSpecificIdentity[]>;
const toGeneric = ref(null) as Ref<DocumentGeneralIdentity | null>;
const toSpecific = ref([]) as Ref<DocumentSpecificIdentity[]>;
const before = ref(null) as Ref<string | null>;
const after = ref(null) as Ref<string | null>;
const type = ref(null) as Ref<DocumentType | null>;
const published = ref(null) as Ref<boolean | null>;
const searching = ref(false);
const q = computed(() => {
  return query(
    documentsCollection(),
    ...([
      props.filterReign || reign.value ? where('reign', '==', props.filterReign ?? reign.value) : null,
      fromGeneric.value && fromSpecific.value.length === 0
        ? where(
            'fromSpecific',
            'in',
            Object.values(DocumentSpecificIdentity.VALUES)
              .filter((i) => i.generic.firebase === fromGeneric.value?.firebase)
              .map((i) => i.firebase),
          )
        : null,
      fromSpecific.value.length > 0
        ? where(
            'fromSpecific',
            'in',
            fromSpecific.value.map((i) => i.firebase),
          )
        : null,
      toGeneric.value && toSpecific.value.length === 0
        ? where(
            'toSpecific',
            'array-contains-any',
            Object.values(DocumentSpecificIdentity.VALUES)
              .filter((i) => i.generic.firebase === toGeneric.value?.firebase)
              .map((i) => i.firebase),
          )
        : null,
      toSpecific.value.length > 0
        ? where(
            'toSpecific',
            'array-contains-any',
            toSpecific.value.map((i) => i.firebase),
          )
        : null,
      before.value ? where('publishedAt', '<=', new Date(before.value)) : null,
      after.value ? where('publishedAt', '>=', new Date(after.value + ' 23:59:59')) : null,
      type.value || props.filterType ? where('type', '==', type.value?.firebase ?? props.filterType) : null,
      published.value === null ? null : where('published', '==', published.value),
      props.manage ? null : where('published', '==', true),
      props.manage ? null : where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
      orderBy('published', 'asc'),
      orderBy('createdAt', 'desc'),
    ].filter((i) => !!i) as any[]),
  );
});
const lastCreatedAt = ref(undefined) as Ref<number | undefined>;
const lastPublished = ref(false);
const totalDocs = ref(0);
const scroll = ref();
const paginatedQ = computed(() => {
  if (lastCreatedAt.value) {
    return query(q.value, limit(10), startAt(lastPublished.value, new Timestamp(lastCreatedAt.value / 1000 + 1, 0)));
  } else {
    return query(q.value, limit(10));
  }
});
const allDocs = reactive({} as { [id: string]: Document });
const updateTotal = async () => {
  try {
    lastCreatedAt.value = undefined;
    lastPublished.value = false;
    Object.keys(allDocs).forEach((k) => delete allDocs[k]);
    totalDocs.value = (await getCountFromServer(q.value)).data().count;
    if (!process.env.SERVER) {
      scroll.value.updateScrollTarget();
      scroll.value.resume();
    }
  } catch (e) {
    notifyError('無法以此條件搜尋公文', e);
  }
};
watch(q, updateTotal, { deep: true });

async function loadMore(i: number, done: (stop?: boolean) => void) {
  if (searching.value) {
    return;
  }
  if (Object.values(allDocs).length >= totalDocs.value) {
    done(true);
  } else {
    searching.value = true;
    const docs = await getDocs(paginatedQ.value);
    docs.forEach((doc) => {
      allDocs[doc.id] = doc.data() as Document;
    });
    lastPublished.value = Object.values(allDocs).filter((d) => d.published).length > 0;
    const newLast = Object.values(allDocs)
      .filter((v) => (lastPublished.value ? v.published : true))
      .sort((a, b) => (a.createdAt?.valueOf() ?? 0) - (b.createdAt?.valueOf() ?? 0))[0];
    if (newLast) {
      lastCreatedAt.value = newLast.createdAt?.valueOf();
    }
    searching.value = false;
    done();
  }
}

function choosePublished() {
  if (published.value === false) {
    before.value = null;
    after.value = null;
  }
}

void updateTotal();
</script>

<style lang="scss" scoped>
.col {
  min-width: 150px;
}

.bg-highlight {
  background-color: #f2c03730;
}
</style>
