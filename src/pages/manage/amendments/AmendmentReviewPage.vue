<template>
  <q-page class="q-pa-md q-pa-sm-xl q-pa-md-xl relative-position" style="max-width: 1000px; margin: auto">
    <div class="text-h4 q-my-lg text-bold">修正草案審查</div>

    <div v-if="requestData === undefined || processing" class="text-center q-pa-xl">
      <q-spinner-dots color="primary" size="3em" />
      <div v-if="processing" class="text-h6 q-mt-md text-primary">正在執行中...</div>
    </div>

    <div v-else-if="requestData === null" class="text-center q-pa-xl">
      <q-icon :name="matError" color="negative" size="4em" />
      <div class="text-h6 q-mt-md">找不到該修正草案請求</div>
    </div>

    <div v-else>
      <q-card flat bordered class="q-mb-lg">
        <q-card-section class="bg-primary text-white row items-center justify-between">
          <div>
            <div class="text-h6">{{ legislationData?.name || '正在載入法規名稱...' }}</div>
            <div class="text-subtitle2">草案狀態：待審查</div>
          </div>
          <div>
            <q-chip color="white" text-color="primary" square>提案人：{{ requestData.petitionerName }}</q-chip>
          </div>
        </q-card-section>

        <q-stepper v-model="step" vertical color="primary" animated flat>
          <!-- Step 1: Preview -->
          <q-step :name="1" title="預覽變更內容" :icon="matPreview" :done="step > 1">
            <q-card flat bordered>
              <DraftAmendmentDiffPrint
                v-if="legislationData"
                :legislation="legislationData as unknown as import('src/ts/models').Legislation"
                :amendment-type="requestData.amendmentType"
                :partial-content="requestData.partialContent || []"
                :full-content="requestData.fullContent || []"
              />
            </q-card>
            <q-stepper-navigation>
              <q-btn @click="step = 2" color="primary" label="下一步" />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 2: Decision -->
          <q-step :name="2" title="審核決定" :icon="matGavel" :done="step > 2">
            <div class="q-gutter-sm">
              <q-radio v-model="decision" val="approve" label="同意核可並發布" color="positive" size="lg" />
              <q-radio v-model="decision" val="reject" label="退回草案" color="negative" size="lg" />
            </div>

            <div v-if="decision === 'reject'" class="q-mt-md q-px-sm">
              <q-input v-model="rejectReason" type="textarea" label="退回理由（選填）" outlined rows="3" />
              <q-stepper-navigation>
                <q-btn color="negative" label="確定退回" @click="submitResolution('reject')" :loading="processing" />
                <q-btn flat @click="step = 1" color="primary" label="上一步" class="q-ml-sm" />
              </q-stepper-navigation>
            </div>

            <div v-else-if="decision === 'approve'" class="q-mt-md q-px-sm">
              <q-stepper-navigation>
                <q-btn @click="generateAndProceedToStep3" color="primary" label="進入發布程序" />
                <q-btn flat @click="step = 1" color="primary" label="上一步" class="q-ml-sm" />
              </q-stepper-navigation>
            </div>
          </q-step>

          <!-- Step 3: Draft Document -->
          <q-step :name="3" title="發布公文草稿" :icon="matDescription" :done="step > 3">
            <p>系統已自動產生本次修法的公布令公文稿。您可以直接修改文字，或將草稿儲存至公文系統使用進階編輯器（例如新增附件）後再回來繼續發布。</p>
            <q-input v-model="draftDocumentFromName" label="發文者姓名" outlined class="q-mb-md" />
            <q-input v-model="draftDocumentContent" type="textarea" label="公文內文" outlined rows="6" />

            <div class="q-gutter-sm q-mt-md">
              <q-btn
                v-if="!draftDocumentId"
                outline
                color="secondary"
                :icon="matOpenInNew"
                label="儲存草稿並使用進階編輯器"
                @click="saveAdvancedDraft"
                :loading="processing"
              />
              <q-btn
                v-else
                outline
                color="positive"
                :icon="matOpenInNew"
                :label="`已起草，點此編輯 (編號: ${draftDocumentId})`"
                :href="'/manage/document/' + draftDocumentId"
                target="_blank"
              />
            </div>

            <q-stepper-navigation class="q-mt-lg">
              <q-btn @click="step = 4" color="primary" label="下一步" />
              <q-btn flat @click="step = 2" color="primary" label="上一步" class="q-ml-sm" />
            </q-stepper-navigation>
          </q-step>

          <!-- Step 4: History Summary -->
          <q-step :name="4" title="立法沿革與發布" :icon="matHistory" :done="step > 4">
            <p>將自動建立一筆立法沿革摘要，系統已依變更條文自動生成，請確認或修改：</p>
            <q-input v-model="historySummary" label="立法沿革摘要" outlined />

            <q-stepper-navigation class="q-mt-lg">
              <q-btn color="positive" label="確定核准並發布" @click="submitResolution('approve')" :loading="processing" :icon="matCelebration" />
              <q-btn flat @click="step = 3" color="primary" label="上一步" class="q-ml-sm" />
            </q-stepper-navigation>
          </q-step>
        </q-stepper>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { matCelebration, matCheck, matDescription, matError, matGavel, matHistory, matOpenInNew, matPreview } from '@quasar/extras/material-icons';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDocument, useFirestore } from 'vuefire';
import { doc, updateDoc } from 'firebase/firestore';
import { useQuasar } from 'quasar';
import { getFunctions } from 'firebase/functions';
import DraftAmendmentDiffPrint from 'components/legislation/DraftAmendmentDiffPrint.vue';
import { getEmptyDocument, create as createDocument } from 'src/pages/manage/document/common';
import { DocumentType, DocumentSpecificIdentity } from 'src/ts/models';
import JSConfetti from 'js-confetti';
import { useFunctionAsync } from 'src/boot/vuefire';
import { useCurrentUser } from 'src/ts/auth';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const functions = getFunctions();
const db = useFirestore();

const jsConfetti = new JSConfetti();

const requestId = computed(() => route.params.id as string);
const requestRef = computed(() => (requestId.value ? doc(db, 'amendmentRequests', requestId.value) : null));
const { data: requestData } = useDocument(requestRef);

const legislationId = computed(() => requestData.value?.legislationId);
const legislationRef = computed(() => (legislationId.value ? doc(db, 'legislation', legislationId.value) : null));
const { data: legislationData } = useDocument(legislationRef);

const processing = ref(false);

const step = ref(1);
const decision = ref<'approve' | 'reject' | null>(null);
const rejectReason = ref('');
const draftDocumentContent = ref('');
const historySummary = ref('');
const draftDocumentId = ref<string | null>(null);
const draftDocumentFromName = ref('');

let hydrated = false;

// Hydrate from Firestore once data loads
const hydrationWatcher = watch(
  requestData,
  (newData) => {
    if (!hydrated && newData) {
      if (newData.reviewState) {
        if (newData.reviewState.step) step.value = newData.reviewState.step;
        if (newData.reviewState.decision) decision.value = newData.reviewState.decision;
        if (newData.reviewState.rejectReason) rejectReason.value = newData.reviewState.rejectReason;
        if (newData.reviewState.draftDocumentContent) draftDocumentContent.value = newData.reviewState.draftDocumentContent;
        if (newData.reviewState.historySummary) historySummary.value = newData.reviewState.historySummary;
        if (newData.reviewState.draftDocumentId) draftDocumentId.value = newData.reviewState.draftDocumentId;
        if (newData.reviewState.draftDocumentFromName) draftDocumentFromName.value = newData.reviewState.draftDocumentFromName;
      }
      hydrated = true;
    }
  },
  { immediate: true },
);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  [step, decision, rejectReason, draftDocumentContent, historySummary, draftDocumentId, draftDocumentFromName],
  () => {
    if (!hydrated || !requestRef.value) return;
    if (debounceTimer) clearTimeout(debounceTimer);

    // Auto sync state directly to firestore
    debounceTimer = setTimeout(() => {
      void updateDoc(requestRef.value as any, {
        reviewState: {
          step: step.value,
          decision: decision.value,
          rejectReason: rejectReason.value,
          draftDocumentContent: draftDocumentContent.value,
          historySummary: historySummary.value,
          draftDocumentId: draftDocumentId.value,
          draftDocumentFromName: draftDocumentFromName.value,
        },
      });
    }, 1000);
  },
  { deep: true },
);

function generateAndProceedToStep3() {
  const reqData = requestData.value;
  if (!reqData) return;

  if (!draftDocumentFromName.value && useCurrentUser().value?.displayName) {
    draftDocumentFromName.value = useCurrentUser().value?.displayName || '';
  }

  if (reqData.amendmentType === 'full') {
    historySummary.value = `公布${reqData.legislationName}全文修正共${reqData.legislationArticleCount}條`;
    draftDocumentContent.value = `茲修正${reqData.legislationName}全文共${reqData.legislationArticleCount}條，公布之。`;
  } else {
    const modifiedClauses: string[] = [];
    const deletedClauses: string[] = [];
    const addedClauses: string[] = [];

    for (const change of reqData.partialContent || []) {
      if (change.status === 'unchanged') continue;
      const title = change.current?.title || change.originalContent?.title || '';
      if (change.status === 'added') addedClauses.push(title);
      else if (change.status === 'deleted') deletedClauses.push(title);
      else if (change.status === 'modified') modifiedClauses.push(title);
    }

    const summaryParts = [];
    if (addedClauses.length > 0) summaryParts.push(`增訂${addedClauses.join('、')}條文`);
    if (modifiedClauses.length > 0) summaryParts.push(`修正${modifiedClauses.join('、')}條文`);
    if (deletedClauses.length > 0) summaryParts.push(`刪除${deletedClauses.join('、')}條文`);
    historySummary.value = '公布' + summaryParts.join('，');

    const docParts = [];
    if (addedClauses.length > 0) docParts.push(`增訂${reqData.legislationName}${addedClauses.join('、')}`);
    if (modifiedClauses.length > 0) docParts.push(`修訂${reqData.legislationName}${modifiedClauses.join('、')}`);
    if (deletedClauses.length > 0) docParts.push(`刪除${reqData.legislationName}${deletedClauses.join('、')}`);
    draftDocumentContent.value = `茲${docParts.join('，')}，公布之。`;
  }

  step.value = 3;
}

async function saveAdvancedDraft() {
  processing.value = true;
  try {
    const adding = getEmptyDocument();
    adding.type = DocumentType.Order;
    adding.subject = `公布${requestData.value?.legislationName}修正草案`;
    adding.content = draftDocumentContent.value;
    if (draftDocumentFromName.value) adding.fromName = draftDocumentFromName.value;

    adding.fromSpecific = DocumentSpecificIdentity.Chairman;
    const category = legislationData.value?.category?.firebase || legislationData.value?.category;
    if (category === 'StudentCouncilOrder') adding.fromSpecific = DocumentSpecificIdentity.Speaker;
    if (category === 'JudicialCommitteeOrder') adding.fromSpecific = DocumentSpecificIdentity.JudicialCommitteeChairman;

    adding.toSpecific = [
      DocumentSpecificIdentity.StudentCouncil,
      DocumentSpecificIdentity.JudicialCommittee,
      DocumentSpecificIdentity.ExecutiveDepartment,
    ];

    const newId = await createDocument(adding, false);
    draftDocumentId.value = newId;
    $q.notify({ color: 'positive', message: '草稿儲存成功，可再次點擊以開啟進階編輯器' });
  } catch (e: any) {
    $q.notify({ color: 'negative', message: '草稿儲存失敗: ' + e.message });
  } finally {
    processing.value = false;
  }
}

async function submitResolution(action: 'approve' | 'reject') {
  processing.value = true;
  try {
    const payloads: Record<string, any> = {
      requestId: requestId.value,
      action,
      resolutionReason: rejectReason.value || undefined,
    };
    if (action === 'approve') {
      payloads.historySummary = historySummary.value;
      let finalDocId = draftDocumentId.value;

      if (!finalDocId) {
        const adding = getEmptyDocument();
        adding.type = DocumentType.Order;
        adding.subject = `公布${requestData.value?.legislationName}修正草案`;
        adding.content = draftDocumentContent.value;
        if (draftDocumentFromName.value) adding.fromName = draftDocumentFromName.value;

        adding.fromSpecific = DocumentSpecificIdentity.Chairman;
        const category = legislationData.value?.category?.firebase || legislationData.value?.category;
        if (category === 'StudentCouncilOrder') adding.fromSpecific = DocumentSpecificIdentity.Speaker;
        if (category === 'JudicialCommitteeOrder') adding.fromSpecific = DocumentSpecificIdentity.JudicialCommitteeChairman;

        adding.toSpecific = [
          DocumentSpecificIdentity.StudentCouncil,
          DocumentSpecificIdentity.JudicialCommittee,
          DocumentSpecificIdentity.ExecutiveDepartment,
        ];

        finalDocId = await createDocument(adding, false);
      }

      payloads.documentId = finalDocId;
    }

    const resolveAmendmentRequest = await useFunctionAsync('resolveAmendmentRequest');
    const result = await resolveAmendmentRequest(payloads);

    if (action === 'approve') {
      void jsConfetti.addConfetti();
      $q.notify({ color: 'positive', icon: matCheck, message: '草案已成功核可並發布' });
      const docId = (result.data as any)?.result?.documentId;
      if (docId) void router.push('/manage/document/' + docId);
    } else {
      $q.notify({ color: 'positive', icon: matCheck, message: '草案已退回' });
      void router.push('/');
    }
  } catch (err: any) {
    if (err.code === 'functions/permission-denied') {
      $q.notify({ color: 'negative', icon: matError, message: '權限不足：您並非此法規類別對應的首長或權責人員。' });
    } else {
      $q.notify({ color: 'negative', icon: matError, message: '操作失敗：' + err.message });
    }
  } finally {
    processing.value = false;
  }
}
</script>
