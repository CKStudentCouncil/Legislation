<template>
  <q-page padding>
    <q-input v-model="docIdInput" class="col q-pr-sm" clearable label="以公文字號查詢" debounce="500" />
    <q-no-ssr v-if="filters" :class="$q.screen.gt.xs ? 'row' : ''">
      <q-input v-model="reign" :label="`屆次 (例：${getCurrentReign()})`" :rules="[isReign]" class="col q-pr-sm" clearable debounce="500" />
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
      <q-select v-if="manage" v-model="manageScope" :options="manageScopes" class="col q-pr-sm" label="公文範圍" />
      <q-checkbox v-if="manage" v-model="published" class="col q-pr-sm" label="已發布" @update:model-value="choosePublished" />
    </q-no-ssr>
    <div class="text-grey-6">共 {{ totalDocs }} 件公文符合查詢條件</div>
    <q-infinite-scroll ref="scroll" :class="$q.screen.gt.sm ? 'row' : ''" @load="loadMore">
      <div v-for="doc of allDocs" :key="doc!.idPrefix + doc!.idNumber" :class="'q-mb-md q-pr-md ' + ($q.screen.gt.sm && dense ? 'col-6' : '')">
        <q-card :class="doc.published ? '' : 'bg-highlight'">
          <div v-if="!!doc">
            <q-card-section>
              <div>{{ doc.getFullId() }}</div>
              <div v-if="!doc.published" class="text-amber-9">
                <q-icon class="q-pr-sm" name="warning" />
                未發布
              </div>
              <div>{{ doc.publishedAt?.toLocaleDateString() }}</div>
              <div class="text-h6">{{ doc.subject }}</div>
            </q-card-section>
            <q-separator />
            <q-card-actions>
              <q-btn v-if="manage" :to="`/manage/document/${doc.getFullId()}`" color="secondary" flat label="編輯" />
              <q-btn :title="doc.subject" :to="`/document/${doc.getFullId()}`" color="primary" flat icon="visibility" label="檢視" role="link" />
              <q-btn color="primary" flat icon="link" label="複製連結" @click="copyDocLink(doc.getFullId())" />
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
import { copyDocLink, getMeta, notifyError } from 'src/ts/utils.ts';
import { getCurrentReign } from 'src/ts/shared-utils.ts';
import type { Ref } from 'vue';
import { computed, reactive, ref, watch } from 'vue';
import type { Document } from 'src/ts/models.ts';
import { DocumentConfidentiality, DocumentGeneralIdentity, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';
import { documentsCollection } from 'src/ts/model-converters.ts';
import { getCountFromServer, getDocs, limit, orderBy, query, startAfter, where, or, and } from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { isReign, optionalDate } from 'src/ts/checks.ts';
import { useMeta } from 'quasar';
import { loggedInUser, useCurrentClaims } from 'src/ts/auth.ts';
import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

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
  meta: {
    type: Boolean,
    default: true,
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
const manageScopes = ['公開公文', '我起草的公文', '分享給我的密件', '所有我能檢視的公文'];
const manageScope = ref('我起草的公文');
const loggedInUserClaims = useCurrentClaims();
const docId = ref(null) as Ref<string | null>;
const docIdInput = ref(null) as Ref<string | null>;
const route = useRoute();
const router = useRouter();

const FILTER_QUERY_KEYS = new Set([
  'docId',
  'reign',
  'before',
  'after',
  'type',
  'fromGeneric',
  'fromSpecific',
  'toGeneric',
  'toSpecific',
  'published',
  'manageScope',
]);

function firstQueryValue(value: LocationQuery[string] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function listQueryValues(value: LocationQuery[string] | undefined) {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return typeof value === 'string' ? [value] : [];
}

function pickSpecificIdentities(values: string[]) {
  const allSpecific = Object.values(DocumentSpecificIdentity.VALUES);
  return allSpecific.filter((i) => values.includes(i.firebase));
}

function buildFilterQuery(): LocationQueryRaw {
  const query: LocationQueryRaw = {};
  if (docId.value?.trim()) query.docId = docId.value.trim();
  if (reign.value?.trim()) query.reign = reign.value.trim();
  if (before.value) query.before = before.value;
  if (after.value) query.after = after.value;
  if (type.value) query.type = type.value.firebase;
  if (fromGeneric.value) query.fromGeneric = fromGeneric.value.firebase;
  if (fromSpecific.value.length > 0) query.fromSpecific = fromSpecific.value.map((i) => i.firebase);
  if (toGeneric.value) query.toGeneric = toGeneric.value.firebase;
  if (toSpecific.value.length > 0) query.toSpecific = toSpecific.value.map((i) => i.firebase);
  if (published.value !== null) query.published = String(published.value);
  if (props.manage) query.manageScope = manageScope.value;
  return query;
}

function normalizeQueryForCompare(query: LocationQuery | LocationQueryRaw) {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, [...value].map(String).sort()];
      }
      return [key, value === null ? null : String(value)];
    });
}

let syncingFromRoute = false;

function applyQueryToFilters(query: LocationQuery) {
  syncingFromRoute = true;
  const allType = Object.values(DocumentType.VALUES);
  const allGeneric = Object.values(DocumentGeneralIdentity.VALUES);

  const queryDocId = firstQueryValue(query.docId);
  docId.value = queryDocId ?? null;
  docIdInput.value = queryDocId ?? null;

  reign.value = firstQueryValue(query.reign) ?? (props.filters ? getCurrentReign() : null);
  before.value = firstQueryValue(query.before) ?? null;
  after.value = firstQueryValue(query.after) ?? null;

  const typeFirebase = firstQueryValue(query.type);
  type.value = allType.find((i) => i.firebase === typeFirebase) ?? null;

  const fromGenericFirebase = firstQueryValue(query.fromGeneric);
  fromGeneric.value = allGeneric.find((i) => i.firebase === fromGenericFirebase) ?? null;
  fromSpecific.value = pickSpecificIdentities(listQueryValues(query.fromSpecific));

  const toGenericFirebase = firstQueryValue(query.toGeneric);
  toGeneric.value = allGeneric.find((i) => i.firebase === toGenericFirebase) ?? null;
  toSpecific.value = pickSpecificIdentities(listQueryValues(query.toSpecific));

  const publishedValue = firstQueryValue(query.published);
  if (publishedValue === 'true') {
    published.value = true;
  } else if (publishedValue === 'false') {
    published.value = false;
  } else {
    published.value = null;
  }

  const queryManageScope = firstQueryValue(query.manageScope);
  manageScope.value = queryManageScope && manageScopes.includes(queryManageScope) ? queryManageScope : '我起草的公文';
  syncingFromRoute = false;
}

applyQueryToFilters(route.query);
const q = computed(() => {
  const filters = [
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

    ...(props.manage && manageScope.value === '公開公文'
      ? [where('published', '==', true), where('confidentiality', '==', DocumentConfidentiality.Public.firebase)]
      : []),

    ...(props.manage && manageScope.value === '我起草的公文'
      ? loggedInUser.value?.email
        ? [where('authorEmail', '==', loggedInUser.value.email)]
        : [
            where('authorEmail', '==', '___NONE___'),
            where('published', '==', true),
            where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
          ]
      : []),

    ...(props.manage && manageScope.value === '分享給我的密件'
      ? loggedInUserClaims?.roles?.length > 0
        ? [
            where('published', '==', true),
            where('confidentiality', '==', DocumentConfidentiality.Confidential.firebase),
            where('viewers', 'array-contains-any', loggedInUserClaims.roles),
          ]
        : [
            where('authorEmail', '==', '___NONE___'),
            where('published', '==', true),
            where('confidentiality', '==', DocumentConfidentiality.Public.firebase),
          ]
      : []),

    ...(props.manage && manageScope.value === '所有我能檢視的公文'
      ? [
          or(
            ...(loggedInUser.value?.email
              ? [where('authorEmail', 'in', [loggedInUser.value.email, 'legacy'])]
              : [where('authorEmail', '==', 'legacy')]),
            and(where('published', '==', true), where('confidentiality', '==', DocumentConfidentiality.Public.firebase)),
            ...(loggedInUserClaims?.roles?.length > 0
              ? [
                  and(
                    where('published', '==', true),
                    where('confidentiality', '==', DocumentConfidentiality.Confidential.firebase),
                    where('viewers', 'array-contains-any', loggedInUserClaims.roles),
                  ),
                ]
              : []),
          ),
        ]
      : []),

    !props.manage ? where('published', '==', true) : null,
    !props.manage ? where('confidentiality', '==', DocumentConfidentiality.Public.firebase) : null,
  ].filter((i) => !!i) as any[];

  let orderBys = [orderBy('published', 'asc'), orderBy('createdAt', 'desc')];

  if (docId.value?.trim()) {
    const start = docId.value.trim();
    if (start.includes('第')) {
      filters.push(where('__name__', '==', start));
      orderBys = [];
    } else if (start.includes('字')) {
      const prefix = start.replace('字', '');
      filters.push(where('idPrefix', '==', prefix));
      orderBys = [orderBy('idNumber', 'asc')];
    } else {
      const end = start.slice(0, -1) + String.fromCharCode(start.charCodeAt(start.length - 1) + 1);
      filters.push(where('idNumber', '>=', start), where('idNumber', '<', end));
      orderBys = [orderBy('idNumber', 'asc')];
    }
  }

  if (filters.length > 0) {
    return query(documentsCollection(), and(...filters), ...orderBys);
  } else {
    return query(documentsCollection(), ...orderBys);
  }
});
const lastVisibleDoc = ref(undefined) as Ref<QueryDocumentSnapshot<Document | null> | undefined>;
const totalDocs = ref(0);
const scroll = ref();
const paginatedQ = computed(() => {
  return lastVisibleDoc.value ? query(q.value, startAfter(lastVisibleDoc.value), limit(10)) : query(q.value, limit(10));
});
const allDocs = reactive({} as { [id: string]: Document });
const updateTotal = async () => {
  try {
    lastVisibleDoc.value = undefined;
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

watch(
  [docId, reign, before, after, type, fromGeneric, fromSpecific, toGeneric, toSpecific, published, manageScope],
  async () => {
    if (syncingFromRoute) {
      return;
    }

    const nextFilterQuery = buildFilterQuery();
    const preservedEntries = Object.entries(route.query).filter(([key]) => !FILTER_QUERY_KEYS.has(key));
    const nextQuery = Object.fromEntries(preservedEntries) as LocationQueryRaw;
    Object.assign(nextQuery, nextFilterQuery);

    const currentNormalized = normalizeQueryForCompare(route.query);
    const nextNormalized = normalizeQueryForCompare(nextQuery);
    if (JSON.stringify(currentNormalized) === JSON.stringify(nextNormalized)) {
      return;
    }

    await router.replace({ query: nextQuery });
  },
  { deep: true },
);

watch(
  () => route.query,
  (query) => {
    applyQueryToFilters(query);
  },
  { deep: true },
);

watch(docIdInput, (value) => {
  const trimmed = value?.trim() ?? '';
  docId.value = trimmed.length > 0 ? trimmed : null;
});

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
    lastVisibleDoc.value = docs.docs.at(-1);
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

if (props.meta) useMeta({ title: '檢視公文', meta: getMeta('檢視公文') });
//TODO: SSR
</script>
<style lang="scss" scoped>
.col {
  min-width: 150px;
}

.bg-highlight {
  background-color: #f2c03730;
}
</style>
