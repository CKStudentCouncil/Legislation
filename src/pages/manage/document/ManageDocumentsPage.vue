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
import { DocumentConfidentiality, DocumentGeneralIdentity, documentsCollection, DocumentSpecificIdentity } from 'src/ts/models.ts';
import { generateDocumentIdNumber, getCurrentReign } from 'src/ts/utils.ts';
import { doc, setDoc } from 'firebase/firestore';
import { Loading, Notify } from 'quasar';
import { useRouter } from 'vue-router';

const action = ref<'add' | null>(null);
const adding = reactive({} as models.Document);
const router = useRouter();

function add() {
  adding.type = models.DocumentType.MeetingNotice;
  adding.reign = getCurrentReign();
  adding.from = DocumentGeneralIdentity.StudentCouncil;
  adding.fromSpecific = DocumentSpecificIdentity.Speaker;
  adding.to = [DocumentGeneralIdentity.StudentCouncil];
  adding.toSpecific = [DocumentSpecificIdentity.StudentCouncilRepresentative];
  adding.toOther = [];
  adding.cc = [];
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
    adding.idPrefix = adding.from.prefix + adding.fromSpecific.prefix + adding.type.prefix + '字';
    adding.idNumber = await generateDocumentIdNumber(adding.fromSpecific);
    adding.createdAt = new Date();
    if (adding.type == models.DocumentType.MeetingNotice) {
      const date = new Date();
      adding.content = `<div>一、___案</div><div>二、___案</div><div>開會時間：中華民國${date.getFullYear() - 1911}年${date.getMonth()+1}月日（星期）中午12時20分</div><div>開會地點：夢紅樓五樓 公民審議論壇教室</div><div>主持人：議長</div><div><br></div><div>備註：</div><div>一、請尚未加入本期間班級代表LINE社群的班代盡快加入，以便聯繫及接收最新開會資訊。</div><div>二、班代大會為本校重要學生自治機關，請各位班級代表務必出席，不勝感激。不克出席者請請假或由同班同學代理。</div><div>三、任何會議資料及會議相關事宜的更動皆會發布在本會社群。</div>`;
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
