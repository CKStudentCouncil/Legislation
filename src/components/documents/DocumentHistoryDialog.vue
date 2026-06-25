<template>
  <q-dialog v-model="dialogModel">
    <q-card class="history-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 col">歷史版本</div>
        <q-btn v-close-popup dense flat icon="close" round />
      </q-card-section>
      <q-card-section class="row q-col-gutter-md">
        <div class="col-12 col-md-4">
          <div v-if="loading" class="flex flex-center q-pa-lg"><q-spinner color="primary" size="32px" /></div>
          <div v-else-if="versions.length === 0" class="text-grey-7 q-pa-md">尚無歷史紀錄。</div>
          <q-list v-else bordered separator style="max-height: 65vh; overflow-y: auto">
            <q-item
              v-for="v in versions"
              :key="v.versionId"
              clickable
              :active="selected?.versionId === v.versionId"
              active-class="bg-blue-1"
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
              icon="restore"
              label="還原至此版本"
              no-caps
              @click="confirmRevert = true"
            />
          </div>
          <div v-if="!selected" class="text-grey-7 q-pa-md">請選擇左側的版本。</div>
          <div v-else-if="view === 'preview' && selectedDoc" style="max-height: 60vh; overflow-y: auto">
            <DocumentRenderer :doc="selectedDoc" />
          </div>
          <q-no-ssr v-else-if="view === 'diff'">
            <CodeDiff
              :context="5"
              diff-style="word"
              filename="此版本"
              language="plaintext"
              max-height="60vh"
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
import { computed, ref, watch } from 'vue';
import { Dark, Loading } from 'quasar';
import { CodeDiff } from 'v-code-diff';
import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { firebaseApp, useFunctionAsync } from 'src/boot/vuefire.ts';
import { DocumentConfidentiality, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';
import type * as models from 'src/ts/models.ts';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

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
const selected = ref<HistoryVersion | null>(null);
const loading = ref(false);
const view = ref<'preview' | 'diff'>('preview');
const confirmRevert = ref(false);

async function load() {
  loading.value = true;
  try {
    const db = getFirestore(firebaseApp);
    const snap = await getDocs(query(collection(db, 'documents', props.docId, 'history'), orderBy('editedAt', 'desc')));
    versions.value = snap.docs.map((d) => {
      const data = d.data();
      return {
        versionId: (data.versionId as string) ?? d.id,
        snapshot: (data.snapshot as Record<string, any>) ?? {},
        editedAt: data.editedAt?.toMillis ? new Date(data.editedAt.toMillis()) : null,
        editedBy: (data.editedBy as models.DocumentEditor) ?? null,
        changeType: (data.changeType as HistoryVersion['changeType']) ?? 'update',
        parentVersionId: (data.parentVersionId as string) ?? null,
      };
    });
    selected.value = versions.value[0] ?? null;
  } catch (e) {
    notifyError('載入歷史紀錄失敗', e);
  } finally {
    loading.value = false;
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
    notifyError('還原失敗', e);
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
</style>
