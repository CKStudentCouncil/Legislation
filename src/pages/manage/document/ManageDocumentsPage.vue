<template>
  <q-btn class="q-ma-md" color="positive" :icon="matAdd" label="起草公文" @click="add" />
  <DocumentsPageV2 manage />
  <DocumentDialog v-model="adding" :action="action" @canceled="action = null" @submit="submit" />
</template>
<script lang="ts" setup>
import { matAdd } from '@quasar/extras/material-icons';
import DocumentDialog from 'components/DocumentDialog.vue';
import { reactive, ref } from 'vue';
import type * as models from '../../../ts/models';
import { Loading } from 'quasar';
import { useRouter } from 'vue-router';
import { create, getEmptyDocument } from 'pages/manage/document/common.ts';
import DocumentsPageV2 from 'pages/documents/DocumentsPageV2.vue';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { explainWriteError } from 'src/ts/firebase-errors.ts';

const action = ref<'add' | null>(null);
const adding = reactive({} as models.Document);
const router = useRouter();

function add() {
  Object.assign(adding, getEmptyDocument());
  action.value = 'add';
}

async function submit() {
  try {
    Loading.show();
    (adding as any).idNumber = null; // Clears the ID for regeneration in case of repeated creations
    const id = await create(adding);
    action.value = null;
    notifySuccess('起草公文成功');
    await router.push(`/manage/document/${id}`);
  } catch (e) {
    // Same as the template page: an account without a council role is refused by firestore.rules (LEGISLATION-7).
    const { message, report } = explainWriteError(e, '起草公文失敗');
    notifyError(message, e, { report });
    return;
  } finally {
    Loading.hide();
  }
}
</script>
<style scoped></style>
