<template>
  <q-dialog v-model="dialogModel" :maximized="maximized">
    <q-card :class="{ 'history-dialog': !maximized }">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 col">歷史版本</div>
        <q-btn dense flat round :icon="maximized ? matFullscreenExit : matFullscreen" @click="maximized = !maximized">
          <q-tooltip>{{ maximized ? '退出全螢幕' : '全螢幕' }}</q-tooltip>
        </q-btn>
        <q-btn v-close-popup dense flat :icon="matClose" round />
      </q-card-section>
      <q-card-section class="row q-col-gutter-md">
        <div class="col-12 col-md-4">
          <div v-if="loading" class="flex flex-center q-pa-lg"><q-spinner color="primary" size="32px" /></div>
          <div v-else-if="versions.length === 0" class="text-grey-7 q-pa-md">尚無歷史紀錄。</div>
          <q-list v-else bordered separator :style="{ maxHeight: maximized ? '82vh' : '65vh', overflowY: 'auto' }">
            <q-item
              v-for="v in versions"
              :key="v.versionId"
              clickable
              :active="selected?.versionId === v.versionId"
              active-class="history-version--active"
              @click="selected = v"
            >
              <q-item-section>
                <q-item-label>{{ formatTime(v.editedAt) }}</q-item-label>
                <q-item-label caption>{{ v.editedBy?.name || v.editedBy?.email || '未知編輯者' }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip :color="changeColor(v.changeType)" dense text-color="white">{{ changeLabel(v.changeType) }}</q-chip>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-if="!loading && nextBefore !== null" class="text-center q-pt-sm">
            <q-btn color="primary" dense :disable="loadingMore" flat label="載入更早的版本" :loading="loadingMore" no-caps @click="loadMore" />
          </div>
        </div>
        <div class="col-12 col-md-8">
          <div class="row items-center q-mb-sm">
            <q-btn-toggle
              v-model="view"
              :options="[
                { label: '預覽', value: 'preview' },
                { label: '與目前版本比較', value: 'diff' },
              ]"
              dense
              no-caps
              toggle-color="primary"
            />
            <q-space />
            <q-btn
              v-if="canRevert && selected"
              color="brown"
              dense
              :icon="matRestore"
              label="還原至此版本"
              no-caps
              @click="confirmRevert = true"
            />
          </div>
          <div v-if="!selected" class="text-grey-7 q-pa-md">請選擇左側的版本。</div>
          <div v-else-if="view === 'preview' && selectedDoc" :style="{ maxHeight: maximized ? '80vh' : '60vh', overflowY: 'auto' }">
            <DocumentRenderer :doc="selectedDoc" />
          </div>
          <q-no-ssr v-else-if="view === 'diff'">
            <CodeDiff
              :context="5"
              diff-style="word"
              filename="此版本"
              language="plaintext"
              :max-height="maximized ? '80vh' : '60vh'"
              new-filename="目前版本"
              :new-string="currentText"
              :old-string="selectedText"
              :output-format="$q.screen.lt.md ? 'line-by-line' : 'side-by-side'"
              :theme="Dark.isActive ? 'dark' : 'light'"
            />
          </q-no-ssr>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
  <q-dialog v-model="confirmRevert">
    <q-card>
      <q-card-section>
        確認還原至 {{ selected ? formatTime(selected.editedAt) : '' }} 的版本？<br />
        此操作會建立一個新的版本（不會刪除任何歷史），且會保留目前的權限設定。
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="取消" @click="confirmRevert = false" />
        <q-btn color="brown" flat label="確認還原" @click="revert" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { matClose, matFullscreen, matFullscreenExit, matRestore } from '@quasar/extras/material-icons';
import { computed, ref, watch } from 'vue';
import { Dark, Loading } from 'quasar';
import { CodeDiff } from 'v-code-diff';
import { useFunctionAsync } from 'src/boot/vuefire.ts';
import { DocumentConfidentiality, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';
import type * as models from 'src/ts/models.ts';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { explainFunctionError } from 'src/ts/firebase-errors.ts';

interface HistoryVersion {
  versionId: string;
  snapshot: Record<string, any>;
  editedAt: Date | null;
  editedBy: models.DocumentEditor | null;
  changeType: 'create' | 'update' | 'revert';
  parentVersionId: string | null;
}

const props = defineProps<{
  modelValue: boolean;
  docId: string;
  currentDoc: models.Document;
  canRevert: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const dialogModel = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const versions = ref<HistoryVersion[]>([]);
// Where the next page of older versions starts, or null when the list is complete.
const nextBefore = ref<string | null>(null);
const selected = ref<HistoryVersion | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const view = ref<'preview' | 'diff'>('preview');
const confirmRevert = ref(false);
const maximized = ref(false);

// Counts the loads of the list from its first page, so that older versions requested for a list that has been
// reloaded since (the dialog reopened, or a revert) are not appended to the new one.
let generation = 0;

// One page of the list, newest first, starting after the version that `before` names (the newest when it is null).
// Through the function, not a direct Firestore read: it returns only the entries of the document as it exists
// now and leaves out history left behind by an earlier document with the same ID. A page arrives as one JSON
// string (the callable codec cannot be trusted with the entries' contents), with timestamps as epoch
// milliseconds, and holds only as many entries as fit its size limit: nextBefore is the cursor for the older
// ones, or null when there are none.
async function fetchPage(before: string | null): Promise<{ versions: HistoryVersion[]; nextBefore: string | null }> {
  const fn = await useFunctionAsync('listDocumentHistory');
  const res = await fn(before === null ? { docId: props.docId } : { docId: props.docId, before });
  const data = res.data as { versions: string; nextBefore: string | null };
  const entries = JSON.parse(data.versions) as (Omit<HistoryVersion, 'editedAt'> & { editedAt: number | null })[];
  return {
    versions: entries.map((v) => ({ ...v, editedAt: typeof v.editedAt === 'number' ? new Date(v.editedAt) : null })),
    nextBefore: typeof data.nextBefore === 'string' ? data.nextBefore : null,
  };
}

async function load() {
  generation++;
  loading.value = true;
  loadingMore.value = false;
  try {
    const page = await fetchPage(null);
    versions.value = page.versions;
    nextBefore.value = page.nextBefore;
    selected.value = versions.value[0] ?? null;
  } catch (e) {
    notifyError('載入歷史紀錄失敗', e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  const before = nextBefore.value;
  if (before === null || loading.value || loadingMore.value) return;
  const mine = generation;
  loadingMore.value = true;
  try {
    const page = await fetchPage(before);
    if (mine !== generation) return;
    const merged = [...versions.value];
    const known = new Set(merged.map((v) => v.versionId));
    for (const v of page.versions) {
      if (!known.has(v.versionId)) {
        known.add(v.versionId);
        merged.push(v);
      }
    }
    versions.value = merged;
    nextBefore.value = page.nextBefore;
  } catch (e) {
    if (mine === generation) notifyError('載入歷史紀錄失敗', e);
  } finally {
    if (mine === generation) loadingMore.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load();
  },
  { immediate: true },
);

// Rehydrate a stored firebase-format snapshot into a renderable Document (mirrors documentConverter).
function rehydrate(snap: Record<string, any>): models.Document {
  const toDate = (t: any): Date | null => (t && typeof t.toMillis === 'function' ? new Date(t.toMillis()) : t ? new Date(t) : null);
  const d = { ...snap } as any;
  d.createdAt = toDate(snap.createdAt) ?? new Date();
  d.publishedAt = toDate(snap.publishedAt);
  d.declassifyAt = toDate(snap.declassifyAt);
  d.meetingTime = toDate(snap.meetingTime);
  d.confidentiality = DocumentConfidentiality.VALUES[snap.confidentiality as keyof typeof DocumentConfidentiality.VALUES];
  d.fromSpecific = DocumentSpecificIdentity.VALUES[snap.fromSpecific];
  d.type = DocumentType.VALUES[snap.type as keyof typeof DocumentType.VALUES];
  d.toSpecific = (snap.toSpecific ?? []).map((x: string) => DocumentSpecificIdentity.VALUES[x]);
  d.ccSpecific = (snap.ccSpecific ?? []).map((x: string) => DocumentSpecificIdentity.VALUES[x]);
  d.viewers = (snap.viewers ?? []).map((x: string) => DocumentSpecificIdentity.VALUES[x]);
  d.secretarySpecific = snap.secretarySpecific ? DocumentSpecificIdentity.VALUES[snap.secretarySpecific] : null;
  d.attachments = snap.attachments ?? [];
  d.getFullId = function (this: models.Document) {
    return `${this.idPrefix}第${this.idNumber}號`;
  };
  return d as models.Document;
}

const selectedDoc = computed(() => (selected.value ? rehydrate(selected.value.snapshot) : null));

function htmlToText(html: string | undefined): string {
  return (html ?? '')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function docText(subject: string | undefined, content: string | undefined): string {
  return `主旨：${subject ?? ''}\n\n${htmlToText(content)}`;
}

const selectedText = computed(() => (selected.value ? docText(selected.value.snapshot.subject, selected.value.snapshot.content) : ''));
const currentText = computed(() => docText(props.currentDoc.subject, props.currentDoc.content));

function formatTime(d: Date | null): string {
  return d ? d.toLocaleString() : '未知時間';
}
function changeLabel(t: HistoryVersion['changeType']): string {
  return t === 'create' ? '建立' : t === 'revert' ? '還原' : '編輯';
}
function changeColor(t: HistoryVersion['changeType']): string {
  return t === 'create' ? 'positive' : t === 'revert' ? 'brown' : 'primary';
}

async function revert() {
  if (!selected.value) return;
  confirmRevert.value = false;
  Loading.show({ message: '還原中…' });
  try {
    const fn = await useFunctionAsync('revertDocument');
    await fn({ docId: props.docId, versionId: selected.value.versionId });
  } catch (e) {
    const { message, report } = explainFunctionError(e, '還原失敗');
    notifyError(message, e, { report });
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('已還原至所選版本');
  await load();
}
</script>

<style scoped>
.history-dialog {
  width: min(1300px, 98vw);
  max-width: 1300px;
}

/* Selected-version highlight. Theme-aware: a light tint in light mode, a darker tint in dark mode,
   so the default item text (dark in light mode, light in dark mode) stays readable on both. */
.history-version--active {
  background: #e3f2fd;
}
.body--dark .history-version--active {
  background: rgba(59, 130, 246, 0.28);
}
</style>
