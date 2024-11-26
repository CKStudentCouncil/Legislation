<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!docu">載入中...(或查無此公文)</div>
    <div v-else style="max-width: 1170px">
      <q-select
        v-model="docu.type"
        :option-label="(type) => type.translation"
        :options="Object.values(DocumentType.VALUES)"
        class="q-mb-md"
        label="公文類型"
        @update:model-value="update()"
      />
      <q-btn color="positive" class="q-ma-md" label="編輯資訊" icon="edit"/>
      <q-btn color="primary" label="編輯內文" icon="edit"/>
      <DocumentMeetingNotice v-if="docu.type.firebase == DocumentType.MeetingNotice.firebase" :doc="docu" />
      <ProEditor v-model="docu!.content"/>
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { documentsCollection, DocumentType, useSpecificDocument } from 'src/ts/models.ts';
import DocumentMeetingNotice from 'components/documents/DocumentMeetingNotice.vue';
import { doc, setDoc } from 'firebase/firestore';
import { Loading, Notify } from 'quasar';
import ProEditor from 'components/ProEditor.vue';

const route = useRoute();
const docu = useSpecificDocument(route.params.id as string);

async function update() {
  Loading.show();
  try {
    await setDoc(doc(documentsCollection(), (docu.value as any).id), docu.value);
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '編輯失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '編輯成功',
    color: 'positive',
  });
}
</script>

<style scoped></style>
