<template>
  <q-btn class="q-ma-md" color="positive" icon="add" label="起草公文" @click="add" />
  <DocumentsPage manage />
  <DocumentDialog v-model="adding" :action="action" @canceled="action = null" @submit="submit" />
</template>
<script lang="ts" setup>
import DocumentsPage from 'pages/documents/DocumentsPage.vue';
import DocumentDialog from 'components/DocumentDialog.vue';
import { reactive, ref } from 'vue';
import * as models from '../../../ts/models';
import { DocumentConfidentiality, documentsCollection, DocumentSpecificIdentity } from 'src/ts/models.ts';
import { generateDocumentIdNumber, getCurrentReign } from 'src/ts/utils.ts';
import { doc, setDoc } from 'firebase/firestore';
import { Loading, Notify } from 'quasar';
import { useRouter } from 'vue-router';
import { meetingNoticeTemplate, meetingRecordTemplate } from 'src/ts/template.ts';

const action = ref<'add' | null>(null);
const adding = reactive({} as models.Document);
const router = useRouter();

function add() {
  adding.type = models.DocumentType.MeetingNotice;
  adding.reign = getCurrentReign();
  adding.fromSpecific = DocumentSpecificIdentity.Speaker;
  adding.toSpecific = [DocumentSpecificIdentity.StudentCouncilRepresentative];
  adding.toOther = [];
  adding.ccSpecific = [DocumentSpecificIdentity.Chairman, DocumentSpecificIdentity.ViceChairman, DocumentSpecificIdentity.JudicialCommitteeMember];
  adding.ccOther = [];
  adding.subject = '';
  adding.content = '';
  adding.attachments = [];
  adding.createdAt = new Date();
  adding.confidentiality = DocumentConfidentiality.Public;
  adding.read = [];
  adding.published = false;
  action.value = 'add';
}

async function submit() {
  try {
    Loading.show();
    adding.idPrefix = adding.fromSpecific.generic.prefix + adding.fromSpecific.prefix + adding.type.prefix + '字';
    adding.idNumber = await generateDocumentIdNumber(adding.fromSpecific, adding.type);
    adding.createdAt = new Date();
    switch (adding.type.firebase) {
      case models.DocumentType.MeetingNotice.firebase:
        adding.content = meetingNoticeTemplate();
        break;
      case models.DocumentType.Record.firebase:
        adding.toSpecific = [];
        adding.toOther = [];
        adding.ccSpecific = [];
        adding.ccOther = [];
        adding.confidentiality = DocumentConfidentiality.Public;
        adding.content = meetingRecordTemplate();
        break;
      case models.DocumentType.Order.firebase:
        adding.toSpecific = [];
        adding.toOther = [];
        adding.ccSpecific = [];
        adding.ccOther = [];
        adding.confidentiality = DocumentConfidentiality.Public;
        break;
    }
    const id = adding.idPrefix + '第' + adding.idNumber + '號';
    await setDoc(doc(documentsCollection(), id), adding);
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
