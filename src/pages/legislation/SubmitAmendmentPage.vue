<template>
  <q-page padding>
    <div style="max-width: min(800px, 97vw); margin: 0 auto">
      <h1 class="text-h4 q-mt-md flex-center text-center">送出修法草案</h1>

      <div v-if="!legislationData">載入法規中...</div>
      <div v-else-if="!amendmentStore.activeDraftId" class="text-center q-pa-xl text-grey-7">
        <q-icon :name="matWarning" size="48px" class="q-mb-md" />
        <div class="text-h6">查無欲送出的草案記錄</div>
        <p>您尚未選擇或編輯要送出的修法草案，請先建立草案。</p>
        <q-btn color="primary" label="回到草案編輯區" outline :to="`/legislation/${route.params.id}/amendment`" />
      </div>
      <div v-else-if="!user" class="text-center q-pa-xl">
        <q-icon :name="matAccountCircle" size="48px" class="text-negative q-mb-md" />
        <div class="text-h6 text-negative">請先登入</div>
        <p>為了確保草案提案為具名並可聯繫，請先點擊網頁右上角登入後再提交修正草案。</p>
        <q-btn color="primary" label="回到上一步" outline :to="`/legislation/${route.params.id}/amendment`" />
      </div>

      <q-card v-else class="q-mt-xl">
        <q-card-section class="bg-primary text-white row items-center">
          <div class="text-h6">確認送出資訊</div>
        </q-card-section>
        <q-card-section class="q-pt-md">
          <p>
            您即將將修改後的草案
            <strong>{{ amendmentStore.getActiveDraftName() }}</strong> 送出至主管機關進行審核公布。
          </p>
          <q-list bordered class="rounded-borders q-mb-md">
            <q-item>
              <q-item-section avatar>
                <q-icon :name="matPerson" />
              </q-item-section>
              <q-item-section>
                <q-item-label>聯絡人姓名</q-item-label>
                <q-item-label caption>{{ user.displayName || '未提供名稱' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section avatar>
                <q-icon :name="matEmail" />
              </q-item-section>
              <q-item-section>
                <q-item-label>聯絡信箱</q-item-label>
                <q-item-label caption>{{ user.email || '未提供信箱' }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-expansion-item :icon="matPreview" label="預覽變更內容" dense-toggle>
            <div class="q-pa-md">
              <DraftAmendmentDiffPrint
                :legislation="legislationData as unknown as import('src/ts/models').Legislation"
                :amendment-type="amendmentStore.amendmentType!"
                :partial-content="amendmentStore.partialContent"
                :full-content="amendmentStore.fullContent"
              />
            </div>
          </q-expansion-item>
        </q-card-section>

        <q-card-actions align="right" class="text-primary q-pb-md q-pr-md">
          <q-btn flat label="上一步" :to="`/legislation/${route.params.id}/amendment`" />
          <q-btn color="positive" :icon="matSend" label="確認送出" @click="submitAmendment" :loading="submitLoading" />
        </q-card-actions>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { matAccountCircle, matCheck, matEmail, matError, matPerson, matPreview, matSend, matWarning } from '@quasar/extras/material-icons';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useDocument } from 'vuefire';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { legislationDocument } from 'src/ts/model-converters.ts';
import { useDraftAmendmentStore } from 'src/pages/legislation/draft-amendment';
import DraftAmendmentDiffPrint from 'components/legislation/DraftAmendmentDiffPrint.vue';
import { loggedInUser as user } from 'src/ts/auth.ts';
import { useFunctionAsync } from 'src/boot/vuefire';

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const functions = getFunctions();

const legislationData = useDocument(computed(() => legislationDocument(route.params.id as string)));
const amendmentStore = useDraftAmendmentStore();

const submitLoading = ref(false);

async function submitAmendment() {
  if (!user.value || !user.value.displayName) {
    $q.notify({ color: 'warning', message: '無法取得登入身分或姓名。' });
    return;
  }

  submitLoading.value = true;
  try {
    const submitAmendmentRequest = await useFunctionAsync('submitAmendmentRequest');

    await submitAmendmentRequest({
      legislationId: route.params.id,
      legislationName: legislationData.value?.name,
      legislationCategory: legislationData.value?.category,
      amendmentType: amendmentStore.amendmentType,
      partialContent: amendmentStore.amendmentType === 'partial' ? amendmentStore.partialContent.filter((c) => c.status !== 'unchanged') : undefined,
      fullContent: amendmentStore.amendmentType === 'full' ? amendmentStore.fullContent : undefined,
    });

    $q.notify({ color: 'positive', message: '修正草案已成功送出審查！', icon: matCheck });

    // Clear draft tracking and navigate back to document read page
    amendmentStore.quitDraft();
    void router.push('/legislation/' + (route.params.id as string));
  } catch (error: any) {
    console.error('Submission failed', error);
    $q.notify({ color: 'negative', message: '送出失敗: ' + error.message, icon: matError });
  } finally {
    submitLoading.value = false;
  }
}
</script>
