<template>
  <q-page padding>
    <div v-if="!legislation">查無此法 (或載入中)</div>
    <div v-show="printing" style="position: absolute; top: -9999px; left: -9999px">
      <div ref="printContent" class="official-font-when-printing bg-white text-black" style="width: 100%">
        <DraftAmendmentDiffPrint
          v-if="legislation"
          :legislation="legislation"
          :amendment-type="amendmentStore.amendmentType"
          :partial-content="amendmentStore.partialContent"
          :full-content="amendmentStore.fullContent"
        />
      </div>
    </div>
    <div v-if="legislation" style="max-width: min(1170px, 97vw); margin: 0 auto">
      <h1 class="text-h4 q-mt-none flex-center text-center">
        {{ legislation.name }} 修正草案編輯
        <q-btn class="no-print" dense flat :icon="matLink" size="20px" @click="copyLink()" />
      </h1>

      <q-stepper ref="stepper" v-model="step" animated header-nav class="q-mt-lg">
        <q-step :name="1" :icon="matList" title="草案列表" :done="step > 1">
          <div class="q-pa-md">
            <div class="row items-center q-mb-md">
              <div class="text-h6 col">已儲存的修正草案</div>
              <q-btn class="q-mr-sm" color="primary" label="新增草案" :icon="matAdd" @click="promptNewDraft" />
              <q-btn color="secondary" outline label="匯入草案" :icon="matUpload" @click="triggerImport" />
              <input type="file" ref="fileInput" accept=".ckla" style="display: none" @change="onImportFile" />
            </div>

            <div v-if="amendmentStore.drafts.length === 0" class="text-center q-pa-xl text-grey-7">
              <q-icon :name="matDescription" size="48px" class="q-mb-md" />
              <div>目前沒有已儲存的草案。</div>
              <div class="row q-gutter-md justify-center q-mt-md">
                <q-btn color="primary" outline label="立即建立一份新草案" @click="promptNewDraft" />
                <q-btn color="secondary" outline label="匯入草案檔 (.ckla)" :icon="matUpload" @click="triggerImport" />
              </div>
            </div>

            <q-list v-else separator bordered class="rounded-borders">
              <q-item v-for="draft in amendmentStore.drafts" :key="draft.id" class="q-py-md">
                <q-item-section>
                  <q-item-label class="text-h6">{{ draft.name }}</q-item-label>
                  <q-item-label caption>
                    類型：{{ draft.amendmentType === 'partial' ? '部分修正' : '全文修正' }} | 最後修改：{{
                      new Date(draft.updatedAt).toLocaleString()
                    }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row q-gutter-sm items-center">
                    <q-btn flat round color="secondary" :icon="matBorderColor" size="sm" @click="promptRenameDraft(draft.id, draft.name)">
                      <q-tooltip>重新命名</q-tooltip>
                    </q-btn>
                    <q-btn outline color="primary" label="繼續編輯" @click="openDraft(draft.id)" />
                    <q-btn flat round color="negative" :icon="matDelete" size="sm" @click="confirmDeleteDraft(draft.id)">
                      <q-tooltip>刪除草案</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-step>

        <q-step :name="2" :icon="matEdit" title="編輯草案" :done="step > 2" :disable="!amendmentStore.activeDraftId">
          <div v-if="amendmentStore.amendmentType === 'partial'">
            <div class="q-mb-md">本草案為部分修正。您可以修改、刪除、及拖曳變更順序。</div>
            <q-btn color="positive" flat :icon="matAdd" label="新增內容" @click="addPartialContent()"></q-btn>
            <q-toggle v-model="draggable.partial" label="拖曳排序" />
            <VueDraggable
              v-if="amendmentStore.partialContent"
              ref="el"
              v-model="amendmentStore.partialContent"
              :disabled="!draggable.partial"
              :style="draggable.partial ? 'cursor: move' : ''"
              class="q-gutter-md q-mt-md"
              @update="rearrangePartial"
            >
              <div v-for="(draftInfo, index) in amendmentStore.partialContent" :key="draftInfo.id" class="row items-start border-bottom q-pb-md">
                <q-icon v-if="draggable.partial" class="col-auto q-mr-sm q-mt-sm" :name="matDragIndicator" style="cursor: grab" />
                <div class="col">
                  <!-- Toolbar for this item -->
                  <div class="row items-center q-mb-sm">
                    <q-chip v-if="draftInfo.status === 'unchanged'" color="grey" text-color="white" size="sm">現行條文</q-chip>
                    <q-chip v-if="draftInfo.status === 'added'" color="positive" text-color="white" size="sm">新增</q-chip>
                    <q-chip v-if="draftInfo.status === 'modified'" color="warning" text-color="white" size="sm">修正</q-chip>
                    <q-chip v-if="draftInfo.status === 'deleted'" color="negative" text-color="white" size="sm">刪除</q-chip>

                    <div class="text-bold text-subtitle1 q-ml-sm">
                      <span
                        v-if="
                          draftInfo.current.type.firebase !== ContentType.Clause.firebase &&
                          draftInfo.current.type.firebase !== ContentType.SpecialClause.firebase
                        "
                        :class="{ 'text-strike text-grey': draftInfo.status === 'deleted' }"
                      >
                        {{ draftInfo.current.title }} {{ draftInfo.current.subtitle }}
                      </span>
                      <span v-else :class="{ 'text-strike text-grey': draftInfo.status === 'deleted' }">
                        {{ draftInfo.current.title }}<template v-if="draftInfo.current.subtitle"> 【{{ draftInfo.current.subtitle }}】</template>
                      </span>
                    </div>

                    <q-space />

                    <!-- Actions -->
                    <q-btn flat :icon="matDownloading" size="10px" @click="addPartialContent(index)">
                      <q-tooltip>向下新增一項內容</q-tooltip>
                    </q-btn>

                    <template v-if="draftInfo.status === 'unchanged'">
                      <q-btn flat color="primary" :icon="matEdit" size="10px" @click="editPartialContent(index)">
                        <q-tooltip>修改內容</q-tooltip>
                      </q-btn>
                      <q-btn flat color="negative" :icon="matDelete" size="10px" @click="markPartialDeleted(index)">
                        <q-tooltip>標示為刪除</q-tooltip>
                      </q-btn>
                    </template>

                    <template v-if="draftInfo.status === 'modified'">
                      <q-btn flat color="primary" :icon="matEdit" size="10px" @click="editPartialContent(index)" />
                      <q-btn flat color="info" :icon="matRestore" size="10px" @click="restorePartial(index)">
                        <q-tooltip>復原修改</q-tooltip>
                      </q-btn>
                    </template>

                    <template v-if="draftInfo.status === 'deleted'">
                      <q-btn flat color="info" :icon="matRestore" size="10px" @click="restorePartial(index)" label="取消刪除" />
                    </template>

                    <template v-if="draftInfo.status === 'added'">
                      <q-btn flat color="primary" :icon="matEdit" size="10px" @click="editPartialContent(index)" />
                      <q-btn color="negative" flat :icon="matDelete" size="10px" @click="removePartial(index)" />
                    </template>
                  </div>

                  <!-- Content Display -->
                  <div class="q-pl-md">
                    <div v-if="draftInfo.status === 'unchanged'" class="q-mt-sm">
                      <InlineDiffRenderer :old-string="draftInfo.current.content || ''" :new-string="draftInfo.current.content || ''" render-lines />
                    </div>
                    <div v-else-if="draftInfo.status === 'deleted'" class="text-strike text-grey-7 q-mt-sm">
                      <InlineDiffRenderer
                        :old-string="draftInfo.originalContent?.content || ''"
                        :new-string="draftInfo.originalContent?.content || ''"
                        render-lines
                      />
                    </div>
                    <div v-else-if="draftInfo.status === 'modified'" class="q-mt-sm">
                      <InlineDiffRenderer
                        :old-string="draftInfo.originalContent?.content || ''"
                        :new-string="draftInfo.current.content || ''"
                        render-lines
                      />
                    </div>
                    <div v-else-if="draftInfo.status === 'added'" class="text-positive q-mt-sm">
                      <InlineDiffRenderer :old-string="draftInfo.current.content || ''" :new-string="draftInfo.current.content || ''" render-lines />
                    </div>

                    <div v-if="draftInfo.status !== 'unchanged'" class="q-mt-sm">
                      <q-input v-model="draftInfo.comment" type="textarea" label="修正說明 / 理由" outlined dense autogrow />
                    </div>
                  </div>
                </div>
              </div>
            </VueDraggable>
          </div>

          <div v-else-if="amendmentStore.amendmentType === 'full'">
            <div class="q-mb-md">本草案為全文修正。請拖曳或編輯內容區塊。</div>
            <q-btn color="positive" flat :icon="matAdd" label="新增內容" @click="addContent()"></q-btn>
            <q-toggle v-model="draggable.content" label="拖曳排序" />
            <VueDraggable
              v-if="amendmentStore.fullContent"
              ref="el"
              v-model="amendmentStore.fullContent"
              :disabled="!draggable.content"
              :style="draggable.content ? 'cursor: move' : ''"
              class="q-gutter-md q-mt-md"
              @update="rearrangeFull"
            >
              <div
                v-for="(content, index) of amendmentStore.fullContent"
                :id="content.index.toString()"
                :key="content.index"
                class="row items-center border-bottom q-pb-sm"
              >
                <q-icon v-if="draggable.content" class="col-auto q-mr-sm" :name="matDragIndicator" style="cursor: grab" />
                <LegislationContent :content="content" class="col" />
                <q-btn flat :icon="matDownloading" size="10px" @click="addContent(index)">
                  <q-tooltip>向下新增一項內容</q-tooltip>
                </q-btn>
                <q-btn flat :icon="matEdit" size="10px" @click="editContent(index)" />
                <q-btn color="negative" flat :icon="matDelete" size="10px" @click="removeContent(index)" />
              </div>
            </VueDraggable>
          </div>
        </q-step>
        <q-step :name="3" :icon="matPrint" title="提交與匯出" :disable="!amendmentStore.activeDraftId">
          <div class="text-center q-pa-lg">
            <div class="text-h6 q-mb-xl">您已完成草案編輯！請選擇下一步：</div>
            <div class="row q-gutter-md justify-center">
              <q-btn v-if="!!useCurrentUser()" color="positive" :icon="matSend" label="進入草案送出程序" @click="goToSubmitPage" size="lg" />
              <q-btn color="primary" :icon="matDownload" label="匯出草案檔 (.ckla)" @click="exportJson" size="lg" outline />
              <q-btn color="secondary" :icon="matPrint" label="列印對照表 (PDF)" @click="printPdf" size="lg" outline />
            </div>
            <div class="q-mt-xl text-caption">若您使用列印，請在瀏覽器列印對話框中選擇「另存為 PDF」。</div>
          </div>
        </q-step>

        <template v-slot:navigation>
          <q-stepper-navigation align="right">
            <q-btn v-if="step === 2" flat color="primary" @click="backToList" label="返回列表" class="q-mr-sm" />
            <q-btn v-if="step === 3" flat color="primary" @click="step = 2" label="繼續編輯" class="q-mr-sm" />
            <q-btn v-if="step === 2" color="primary" @click="step = 3" label="完成編輯並匯出" />
          </q-stepper-navigation>
        </template>
      </q-stepper>
    </div>
  </q-page>

  <!-- Dialog for structured content editing -->
  <q-dialog :model-value="contentAction != null" persistent>
    <q-card style="min-width: 80vw">
      <q-card-section>
        <q-select
          v-model="targetContent.type"
          :option-label="(o) => o.translation + (o.firebase == ContentType.SpecialClause.firebase ? ' (訴訟典)' : '')"
          :options="Object.values(models.ContentType.VALUES)"
          label="類型"
          @update:model-value="generateTitle"
        />
        <q-input v-model="targetContent.title" label="標題" />
        <q-input v-model="targetContent.subtitle" :disable="targetContent.deleted" label="副標題 (無須加入中括號)" />
        <q-input
          v-if="targetContent.type.firebase != ContentType.Chapter.firebase"
          v-model="targetContent.content"
          :disable="targetContent.deleted"
          autofocus
          label="內容"
          type="textarea"
          autogrow
        />
        <q-checkbox v-model="targetContent.deleted" label="刪除" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="contentAction = null" />
        <q-btn color="positive" flat label="確定" @click="submitContent" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { matAdd, matBorderColor, matDelete, matDescription, matDownload, matDownloading, matDragIndicator, matEdit, matLink, matList, matPrint, matRestore, matSend, matUpload } from '@quasar/extras/material-icons';
import { computed, ref, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { copyLink, translateNumber, translateNumberToChinese } from 'src/ts/utils.ts';
import { legislationDocument } from 'src/ts/model-converters.ts';
import * as models from 'src/ts/models.ts';
import { ContentType } from 'src/ts/models.ts';
import LegislationContent from 'components/legislation/LegislationContent.vue';
import DraftAmendmentDiffPrint from 'components/legislation/DraftAmendmentDiffPrint.vue';
import { useDraftAmendmentStore } from 'src/pages/legislation/draft-amendment';
import type { AmendmentType, DraftContent, DraftImportPayload } from 'src/pages/legislation/draft-amendment';
import { VueDraggable } from 'vue-draggable-plus';
import { Dialog, exportFile } from 'quasar';
import InlineDiffRenderer from 'components/legislation/InlineDiffRenderer.vue';
import { useVueToPrint } from 'vue-to-print';
import { useDocument } from 'vuefire';
import { useCurrentUser } from 'src/ts/auth';

const route = useRoute();
const router = useRouter();
const legislation = useDocument(computed(() => legislationDocument(route.params.id as string)));
const amendmentStore = useDraftAmendmentStore();

function goToSubmitPage() {
  void router.push('/legislation/' + (route.params.id as string) + '/amendment/submit');
}

const step = ref(1);
const printing = ref(false);
const printContent = ref();
const fileInput = ref<HTMLInputElement | null>(null);

const { handlePrint: printPdf } = useVueToPrint({
  content: printContent,
  documentTitle: () => {
    const draftName = amendmentStore.drafts.find((d) => d.id === amendmentStore.activeDraftId)?.name || '未命名草案';
    return `${legislation.value?.name || '草案'}_${draftName}`;
  },
  removeAfterPrint: true,
  pageStyle: '@page { margin: 2cm !important; }',
  onBeforeGetContent: () => {
    return new Promise((resolve) => {
      printing.value = true;
      setTimeout(() => {
        resolve();
      }, 300);
    });
  },
  onAfterPrint: () => {
    setTimeout(() => {
      printing.value = false;
    }, 300);
  },
});

// Holds pending import data when redirecting to a different legislation
const pendingImportData = ref<DraftImportPayload | null>(null);

// Setup drafts on load or route parameter change
watch(
  () => route.params.id,
  (newId) => {
    if (!newId) return;
    amendmentStore.loadDrafts(newId as string);

    const pendingImport = window.sessionStorage.getItem('pendingImport');
    if (pendingImport) {
      window.sessionStorage.removeItem('pendingImport');
      try {
        const data = JSON.parse(pendingImport);
        if (data.legislationId === newId) {
          // Store for when legislation data is ready
          pendingImportData.value = data;
        } else {
          Dialog.create({
            title: '匯入失敗',
            message: '嘗試自動匯入草案時發生法規 ID 不一致的問題。',
            color: 'negative',
          });
        }
      } catch (e) {
        console.error('Failed to parse pending import', e);
      }
    }
  },
  { immediate: true },
);

// Once legislation data arrives, process the pending import
watch(legislation, (newLegislation) => {
  if (pendingImportData.value && newLegislation && route.params.id === pendingImportData.value.legislationId) {
    const data = pendingImportData.value;
    pendingImportData.value = null;
    processImportData(data);
  }
});

// Sync originalContent from live Firestore data to avoid stale clause text
watch(
  [legislation, () => amendmentStore.activeDraftId],
  ([newLegislation, newDraftId]) => {
    if (!newDraftId || !newLegislation || amendmentStore.amendmentType !== 'partial') return;

    amendmentStore.syncPartialContentWithLive(newLegislation.content);
  },
  { immediate: false },
);

// Watcher to auto-save to local storage whenever there are modifications
watch(
  () => [amendmentStore.amendmentType, amendmentStore.partialContent, amendmentStore.fullContent],
  () => {
    if (amendmentStore.activeDraftId) {
      amendmentStore.saveActiveDraft(route.params.id as string);
    }
  },
  { deep: true },
);

function triggerImport() {
  fileInput.value?.click();
}

function processImportData(data: DraftImportPayload) {
  try {
    const currentLegislationId = route.params.id as string;
    const importResult = amendmentStore.importDraftPayload(currentLegislationId, data, legislation.value?.content || []);

    if (importResult.status === 'redirect') {
      Dialog.create({
        title: '匯入轉向',
        message: '此草案檔屬於另一部法規（ID: ' + importResult.legislationId + '）。即將為您重新導向至該法規的草案編輯頁面並自動匯入...',
        color: 'warning',
      }).onOk(() => {
        window.sessionStorage.setItem('pendingImport', JSON.stringify(data));
        void router.push(`/legislation/${importResult.legislationId}/amendment`);
      });
      return;
    }

    Dialog.create({
      title: '匯入成功',
      message: `已成功匯入草案「${importResult.name}」！`,
      color: 'positive',
    });

    if (fileInput.value) fileInput.value.value = '';
  } catch (err: any) {
    console.error(err);

    let message = '無法解析草案檔案內容，格式可能不正確或已毀損。';
    if (err instanceof Error && err.message === 'Unsupported draft version') {
      message = '不支援此草案版本，請確認檔案來源或聯絡系統管理員。';
    }

    Dialog.create({
      title: '匯入失敗',
      message: message,
      color: 'negative',
    });
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      processImportData(data);
    } catch (err: any) {
      console.error(err);
      Dialog.create({
        title: '匯入失敗',
        message: '無法解析草案檔案內容，格式可能不正確或已毀損。',
        color: 'negative',
      });
      if (fileInput.value) fileInput.value.value = '';
    }
  };
  reader.readAsText(file);
}

function promptNewDraft() {
  Dialog.create({
    title: '新增草案',
    message: '請輸入草案名稱：',
    prompt: {
      model: `${new Date().toLocaleDateString('sv-SE')} 修正草案`,
      type: 'text',
    },
    cancel: true,
    persistent: true,
  }).onOk((name) => {
    promptDraftType(name);
  });
}

function promptDraftType(name: string) {
  Dialog.create({
    title: '選擇修正模式',
    message: '請選擇您的草案要進行部分修正還是全文修正？',
    options: {
      type: 'radio',
      model: 'partial',
      items: [
        { label: '部分修正：針對特定條文進行字句修改、新增、刪除及排序，並附上修正理由。', value: 'partial' },
        { label: '全文修正：重寫整部法規的結構與內容。', value: 'full' },
      ],
    },
    cancel: true,
    persistent: true,
  }).onOk((type: AmendmentType) => {
    amendmentStore.createDraftFromLegislation(route.params.id as string, name, type, legislation.value?.content || []);
    step.value = 2; // Move to editor
  });
}

function promptRenameDraft(id: string, currentName: string) {
  Dialog.create({
    title: '重新命名',
    message: '請輸入新的草案名稱：',
    prompt: {
      model: currentName,
      type: 'text',
    },
    cancel: true,
    persistent: true,
  }).onOk((newName: string) => {
    if (newName && newName.trim() !== '') {
      amendmentStore.renameDraft(route.params.id as string, id, newName.trim());
    }
  });
}

function openDraft(id: string) {
  amendmentStore.selectDraft(id);
  step.value = 2;
}

function confirmDeleteDraft(id: string) {
  Dialog.create({
    title: '確認刪除',
    message: '確定要刪除這份草案嗎？此動作無法復原。',
    cancel: true,
  }).onOk(() => {
    amendmentStore.deleteDraft(route.params.id as string, id);
  });
}

function backToList() {
  amendmentStore.quitDraft();
  step.value = 1;
}

// Editor State
const draggable = reactive({ content: true, partial: true });
const targetContent = reactive({} as models.LegislationContent & { insertBefore?: boolean; isPartial?: boolean; listIndex?: number });
const contentAction = ref<'edit' | 'add' | null>(null);

// PARTIAL EDITOR LOGIC
function addPartialContent(index?: number) {
  targetContent.type = models.ContentType.Clause;
  targetContent.deleted = false;
  targetContent.frozenBy = undefined;
  targetContent.resolutionUrls = undefined;
  targetContent.subtitle = '';
  targetContent.content = '';
  targetContent.insertBefore = index !== undefined;
  targetContent.isPartial = true;
  targetContent.listIndex = index !== undefined ? index + 1 : amendmentStore.partialContent.length;
  generateTitle();
  contentAction.value = 'add';
}

function editPartialContent(index: number) {
  const item = amendmentStore.partialContent[index]!;
  Object.assign(targetContent, item.current);
  targetContent.insertBefore = false; // Just in case
  targetContent.isPartial = true;
  targetContent.listIndex = index;
  contentAction.value = 'edit';
}

function markPartialDeleted(index: number) {
  amendmentStore.markPartialDeleted(index);
}

function restorePartial(index: number) {
  Dialog.create({
    title: '復原',
    message: '確定要還原針對這條文的修改嗎？',
    cancel: true,
  }).onOk(() => {
    amendmentStore.restorePartial(index);
  });
}

function removePartial(index: number) {
  Dialog.create({
    title: '刪除',
    message: '確定要刪除這筆新增的內容嗎？',
    cancel: true,
  }).onOk(() => {
    amendmentStore.removePartial(index);
  });
}

function rearrangePartial() {
  // Can add sorting logic or validation if needed
}

// FULL EDITOR LOGIC
function addContent(index?: number) {
  targetContent.type = models.ContentType.Clause;
  targetContent.deleted = false;
  targetContent.frozenBy = undefined;
  targetContent.resolutionUrls = undefined;
  targetContent.index = index !== undefined ? index + 1 : amendmentStore.fullContent.length;
  targetContent.subtitle = '';
  targetContent.content = '';
  targetContent.insertBefore = index !== undefined;
  targetContent.isPartial = false;
  targetContent.listIndex = index !== undefined ? index + 1 : amendmentStore.fullContent.length;
  generateTitle();
  contentAction.value = 'add';
}

function editContent(index: number) {
  Object.assign(targetContent, amendmentStore.fullContent[index]);
  targetContent.insertBefore = false;
  targetContent.isPartial = false;
  targetContent.listIndex = index;
  contentAction.value = 'edit';
}

function removeContent(index: number) {
  Dialog.create({
    title: '刪除',
    message: '確定要刪除這筆內容嗎？',
    cancel: true,
  }).onOk(() => {
    amendmentStore.removeFullContent(index);
  });
}

function rearrangeFull() {
  for (let i = 0; i < amendmentStore.fullContent.length; i++) {
    amendmentStore.fullContent[i]!.index = i;
  }
}

// SHARED EDITOR LOGIC
function generateTitle() {
  let last = 0;
  const list = targetContent.isPartial ? amendmentStore.partialContent.map((x) => x.current) : amendmentStore.fullContent;
  for (const content of list) {
    if (content.type.firebase == targetContent.type.firebase) {
      const title = content.title.split('-')[0]?.match(/[\d零一二三四五六七八九十百千]+/g);
      if (title) {
        const count = parseInt(title[0].replace(/[零一二三四五六七八九十百千]+/g, (c) => translateNumber(c).toString()));
        if (count > last) {
          last = count;
        }
      }
    }
  }
  targetContent.title = `第 ${targetContent.type.arabicOrdinal ? last + 1 : translateNumberToChinese(last + 1)} ${targetContent.type.translation}`;
}

function submitContent() {
  targetContent.content = targetContent.content?.replaceAll(',', '，').replaceAll(';', '；').replaceAll(':', '：').trim();
  targetContent.subtitle = targetContent.subtitle?.replaceAll('【', '').replaceAll('】', '');

  if (targetContent.isPartial) {
    if (contentAction.value === 'add') {
      const newItem: DraftContent = {
        id: amendmentStore.createDraftItemId(),
        status: 'added',
        current: JSON.parse(JSON.stringify(targetContent)),
        comment: '',
      };
      if (targetContent.insertBefore) {
        amendmentStore.partialContent.splice(targetContent.listIndex!, 0, newItem);
      } else {
        amendmentStore.partialContent.push(newItem);
      }
    } else if (contentAction.value === 'edit') {
      const item = amendmentStore.partialContent[targetContent.listIndex!]!;
      item.current = JSON.parse(JSON.stringify(targetContent));
      if (item.status === 'unchanged') {
        item.status = 'modified';
      }
    }
  } else {
    if (contentAction.value === 'add') {
      if (targetContent.insertBefore) {
        for (let i = targetContent.listIndex!; i < amendmentStore.fullContent.length; i++) {
          amendmentStore.fullContent[i]!.index++;
        }
        amendmentStore.fullContent.splice(targetContent.listIndex!, 0, JSON.parse(JSON.stringify(targetContent)));
        amendmentStore.fullContent.sort((a, b) => a.index - b.index);
      } else {
        amendmentStore.fullContent.push(JSON.parse(JSON.stringify(targetContent)));
      }
    } else if (contentAction.value === 'edit') {
      amendmentStore.fullContent[targetContent.listIndex!] = JSON.parse(JSON.stringify(targetContent));
    }
  }

  contentAction.value = null;
}

// Exports

function exportJson() {
  const draftName = amendmentStore.getActiveDraftName();
  const dataPayload = amendmentStore.buildActiveDraftExportPayload(route.params.id as string);

  const data = JSON.stringify(dataPayload, null, 2);

  const ok = exportFile(`${legislation.value?.name || '草案'}_${draftName}.ckla`, data);
  if (!ok) {
    Dialog.create({ message: '草案匯出失敗。' });
  }
}
</script>

<style scoped>
.border-bottom {
  border-bottom: 1px solid #eee;
}
</style>
