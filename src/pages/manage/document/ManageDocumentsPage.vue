<template>
  <q-btn class="q-ma-md" color="positive" icon="add" label="起草公文" @click="add" />
  <DocumentsPageV2 manage />
  <DocumentDialog v-model="adding" :action="action" @canceled="action = null" @submit="submit" />
</template>
<script lang="ts" setup>
import DocumentDialog from 'components/DocumentDialog.vue';
import { reactive, ref } from 'vue';
import * as models from '../../../ts/models';
import { Loading, Notify } from 'quasar';
import { useRouter } from 'vue-router';
import { create, getEmptyDocument } from 'pages/manage/document/common.ts';
import DocumentsPageV2 from 'pages/documents/DocumentsPageV2.vue';

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
    const id = await create(adding);
    action.value = null;
    Notify.create({ type: 'positive', message: '起草公文成功' });
    await router.push(`/manage/document/${id}`);
  } catch (e) {
    console.error(e);
    Notify.create({ type: 'negative', message: '起草公文失敗' });
    return;
  } finally {
    Loading.hide();
  }
}
</script>
<style scoped></style>
