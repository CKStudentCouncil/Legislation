<template>
  <q-btn class="q-ma-md" color="positive" icon="add" label="起草公文" @click="add" />
  <DocumentsPageV2 manage />
  <DocumentDialog v-model="adding" :action="action" @canceled="action = null" @submit="submit" />
</template>
<script lang="ts" setup>
import DocumentDialog from 'components/DocumentDialog.vue';
import { reactive, ref } from 'vue';
import type * as models from '../../../ts/models';
import { Loading } from 'quasar';
import { useRouter } from 'vue-router';
import { create, getEmptyDocument } from 'pages/manage/document/common.ts';
import DocumentsPageV2 from 'pages/documents/DocumentsPageV2.vue';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

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
    notifyError('起草公文失敗', e);
    return;
  } finally {
    Loading.hide();
  }
}
</script>
<style scoped></style>
