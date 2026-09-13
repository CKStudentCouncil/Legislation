<template>
  <q-dialog v-model="dialogModel">
    <q-card class="history-diff-dialog">
      <q-card-section class="row items-start q-col-gutter-md">
        <div class="col">
          <div class="text-h6">法令版本差異</div>
          <div v-if="selectedHistory" class="text-subtitle2 q-mt-xs">
            {{ formatHistoryLabel(selectedHistory) }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn v-close-popup dense flat :icon="matClose" round />
        </div>
      </q-card-section>
      <q-card-section v-if="selectedHistory" class="q-pt-none">
        <div v-if="isLoading" class="flex flex-center q-pa-lg">
          <q-spinner color="primary" size="40px" />
        </div>
        <template v-else>
          <div v-if="compareTarget === 'previous' && !baselineSnapshotExists" class="text-caption text-grey-7 q-mb-md">
            找不到更早版本的內容快照，以下差異以空白版本為基準。
          </div>
          <q-no-ssr>
            <CodeDiff
              :context="5"
              diff-style="char"
              :filename="truncatedPreviousSnapshotLabel"
              language="plaintext"
              max-height="70vh"
              :new-filename="truncatedSelectedSnapshotLabel"
              :new-string="selectedSnapshotText"
              no-diff-line-feed
              :old-string="baselineSnapshotText"
              :output-format="$q.screen.lt.md ? 'line-by-line' : 'side-by-side'"
              :theme="Dark.isActive ? 'dark' : 'light'"
              force-inline-comparison
            />
          </q-no-ssr>
        </template>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { matClose } from '@quasar/extras/material-icons';
import { computed, ref, watch } from 'vue';
import { Dark } from 'quasar';
import { CodeDiff } from 'v-code-diff';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { firebaseApp } from 'src/boot/vuefire.ts';
import { convertContentFromFirebase } from 'src/ts/models.ts';
import type { LegislationContent as LegislationContentModel, LegislationHistory, ResolutionUrl } from 'src/ts/models.ts';

const props = defineProps<{
  modelValue: boolean;
  selectedHistory: LegislationHistory | null;
  compareTarget: 'previous' | 'current';
  sortedHistory: LegislationHistory[];
  currentContent: LegislationContentModel[];
  legislationId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const contentCache = ref<Record<string, LegislationContentModel[]>>({});
const isLoading = ref(false);

async function loadHistoryContent(contentId: string) {
  if (contentCache.value[contentId]) return;
  const db = getFirestore(firebaseApp);
  const snap = await getDoc(doc(db, 'legislation', props.legislationId, 'historyContent', contentId));
  if (snap.exists()) {
    const data = snap.data();
    contentCache.value = {
      ...contentCache.value,
      [contentId]: (data.content as any[]).map(convertContentFromFirebase),
    };
  }
}

function getHistoryContent(history: LegislationHistory | null): LegislationContentModel[] {
  if (!history) return [];
  if (history.contentId) return contentCache.value[history.contentId] ?? [];
  return [];
}

function computePreviousHistory(): LegislationHistory | null {
  if (props.compareTarget === 'current') return null;
  if (!props.selectedHistory) return null;
  const selectedIndex = props.sortedHistory.findIndex((h: LegislationHistory) => h === props.selectedHistory);
  for (let i = selectedIndex - 1; i >= 0; i--) {
    const candidate = props.sortedHistory[i];
    if (candidate?.contentId) return candidate;
  }
  return null;
}

watch([() => props.modelValue, () => props.selectedHistory, () => props.compareTarget], async ([isOpen]) => {
  if (!isOpen || !props.selectedHistory) return;
  isLoading.value = true;
  try {
    const toLoad: Promise<void>[] = [];
    if (props.selectedHistory.contentId && !contentCache.value[props.selectedHistory.contentId]) {
      toLoad.push(loadHistoryContent(props.selectedHistory.contentId));
    }
    if (props.compareTarget === 'previous') {
      const prev = computePreviousHistory();
      if (prev?.contentId && !contentCache.value[prev.contentId]) {
        toLoad.push(loadHistoryContent(prev.contentId));
      }
    }
    await Promise.all(toLoad);
  } finally {
    isLoading.value = false;
  }
});

const previousHistory = computed(() => computePreviousHistory());

const previousSnapshot = computed(() => getHistoryContent(previousHistory.value));
const hasPreviousSnapshot = computed(() => previousSnapshot.value.length > 0);
const currentSnapshotText = computed(() => formatSnapshot(props.currentContent ?? []));
const previousSnapshotText = computed(() => formatSnapshot(previousSnapshot.value));
const selectedSnapshotText = computed(() => formatSnapshot(getHistoryContent(props.selectedHistory)));
const previousSnapshotLabel = computed(() => {
  if (props.compareTarget === 'current') {
    return '目前版本';
  }
  return previousHistory.value ? formatHistoryLabel(previousHistory.value) : '初始版本';
});
const selectedSnapshotLabel = computed(() => (props.selectedHistory ? formatHistoryLabel(props.selectedHistory) : '目前版本'));
const truncatedPreviousSnapshotLabel = computed(() => truncateDiffFilename(previousSnapshotLabel.value));
const truncatedSelectedSnapshotLabel = computed(() => truncateDiffFilename(selectedSnapshotLabel.value));

const baselineSnapshotText = computed(() => {
  if (props.compareTarget === 'current') {
    return currentSnapshotText.value;
  }
  return previousSnapshotText.value;
});

const baselineSnapshotExists = computed(() => {
  if (props.compareTarget === 'current') {
    return (props.currentContent?.length ?? 0) > 0;
  }
  return hasPreviousSnapshot.value;
});

function formatHistoryLabel(history: LegislationHistory) {
  return `${new Date(history.amendedAt).toLocaleDateString()} ${history.brief}`;
}

function formatSnapshot(snapshot: LegislationContentModel[]) {
  return snapshot.flatMap((contentItem) => formatSnapshotContent(contentItem)).join('\n');
}

function formatSnapshotContent(contentItem: LegislationContentModel) {
  const lines = [formatContentHeading(contentItem)];

  if (contentItem.deleted) {
    lines.push('狀態：已刪除');
  }
  if (contentItem.frozenBy) {
    lines.push(`凍結依據：${contentItem.frozenBy}`);
  }
  if (contentItem.content) {
    lines.push('', contentItem.content);
  }

  const resolutionLines = formatResolutionUrls(contentItem.resolutionUrls);
  if (resolutionLines.length > 0) {
    lines.push('', '相關決議：', ...resolutionLines);
  }

  return [...lines, '', ''];
}

function formatContentHeading(contentItem: LegislationContentModel) {
  return contentItem.subtitle?.length ? `${contentItem.title} 【${contentItem.subtitle}】` : contentItem.title;
}

function formatResolutionUrls(resolutionUrls?: ResolutionUrl[]) {
  if (!resolutionUrls?.length) {
    return [];
  }
  return resolutionUrls.map((item) => `${item.title}: ${item.url}`);
}

function truncateDiffFilename(label: string, maxLength = 40) {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, Math.max(maxLength - 1, 1))}…`;
}
</script>

<style scoped>
.history-diff-dialog {
  width: min(1500px, 98vw);
  max-width: 1500px;
}

.history-diff-dialog :deep(.v-code-diff) {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: hidden;
}
</style>
