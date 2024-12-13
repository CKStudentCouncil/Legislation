<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!docu">載入中...(或查無此公文)</div>
    <div v-else style="max-width: 1170px">
      <div class="q-gutter-md q-mb-md">
        <q-btn color="positive" icon="edit" label="編輯資訊" @click="edit" />
        <q-btn color="primary" icon="edit" label="編輯內文" @click="editContent" />
        <q-btn color="accent" icon="attachment" label="上傳附件" @click="uploadAttachment()" />
        <q-btn color="warning" icon="schedule" label="發布時間" @click="editPublishedAt()" />
        <q-btn v-if="!docu.published" color="secondary" icon="send" label="發布公文">
          <q-popup-proxy>
            <div class="q-ma-lg">
              確認發布公文？發布後將自動導向至檢視頁面
              <q-btn class="q-ml-md" color="primary" label="確認" @click="publish" />
            </div>
          </q-popup-proxy>
        </q-btn>
        <q-btn v-if="docu.published" color="negative" icon="close" label="撤回公文">
          <q-popup-proxy>
            <div class="q-ma-lg">
              確認撤回公文？
              <q-btn class="q-ml-md" color="negative" label="確認" @click="retract" />
            </div>
          </q-popup-proxy>
        </q-btn>
        <q-btn color="negative" icon="delete" label="刪除公文">
          <q-popup-proxy>
            <div class="q-ma-lg">
              確認刪除公文？
              <q-btn class="q-ml-md" color="negative" label="確認" @click="remove" />
            </div>
          </q-popup-proxy>
        </q-btn>
      </div>
      <DocumentRenderer :doc="docu" />
      <div v-if="docu.attachments.length > 0">
        <q-separator class="q-mt-sm q-mb-sm" color="black" />
        <q-toggle v-model="attachmentDraggable" label="拖曳排序" />
        <VueDraggable
          v-if="docu.attachments"
          ref="el"
          v-model="docu.attachments!"
          :disabled="!attachmentDraggable"
          :style="attachmentDraggable ? 'cursor: move' : ''"
          class="q-gutter-md"
          @update="rearrangeAttachment"
        >
          <div v-for="(attachment, index) of docu.attachments" :key="attachment.description + attachment.urls.toString()" class="row">
            <q-icon v-if="attachmentDraggable" class="col self-center q-mr-sm" name="drag_indicator" style="max-width: 10px">
              <q-tooltip>拖曳以重新排序</q-tooltip>
            </q-icon>
            <AttachmentDisplay :attachment="attachment" :order="index + 1" style="width: calc(100% - 110px)" />
            <q-btn flat icon="edit" size="10px" @click="uploadAttachment(attachment)" />
            <q-btn color="negative" flat icon="delete" size="10px" @click="removeAttachment(attachment)" />
          </div>
        </VueDraggable>
      </div>
    </div>
  </q-page>
  <q-dialog v-model="editingContent" persistent>
    <q-card style="min-width: 50vw">
      <q-card-section>
        <div class="text-h5 q-ma-none">編輯內文</div>
      </q-card-section>
      <q-card-section>
        <ProEditor v-model="content" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="editingContent = false" />
        <q-btn color="positive" flat label="確定" @click="submitContent()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="attachmentUploading" persistent>
    <q-card>
      <q-card-section>
        <div class="text-h5 q-ma-none">上傳附件</div>
      </q-card-section>
      <q-card-section>
        <q-input v-model="attachment.description" label="說明" />
        <ListEditor v-model="attachment.urls" />
        <AttachmentUploader :filenamePrefix="`${route.params.id}_附件_`" @uploaded="(u) => attachment.urls.push(...u)" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="attachmentAction = null" />
        <q-btn color="positive" flat label="確定" @click="submitAttachment()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="editingPublishedAt" persistent>
    <q-card>
      <q-card-section>
        <div class="text-h5 q-ma-none">編輯發布時間 (屆數將自動連動)</div>
        <div class="row q-gutter-md q-ml-none">
          <q-date v-model="publishedDate" class="col" mask="YYYY-MM-DD" />
          <q-time v-model="publishedTime" class="col" format24h mask="HH:mm" />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="editingPublishedAt = false" />
        <q-btn color="positive" flat label="確定" @click="submitPublishedAt()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <DocumentDialog v-model="editing" :action="action" @canceled="action = null" @submit="update" />
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { Attachment, documentsCollection, useSpecificDocument } from 'src/ts/models.ts';
import { arrayRemove, arrayUnion, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { date, Loading, Notify } from 'quasar';
import ProEditor from 'components/ProEditor.vue';
import { computed, reactive, ref } from 'vue';
import DocumentDialog from 'components/DocumentDialog.vue';
import * as models from 'src/ts/models';
import AttachmentUploader from 'components/AttachmentUploader.vue';
import ListEditor from 'components/ListEditor.vue';
import { VueDraggable } from 'vue-draggable-plus';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { getReign } from 'src/ts/utils.ts';

const route = useRoute();
const router = useRouter();
const docu = useSpecificDocument(route.params.id as string);
const content = ref('');
const editingContent = ref(false);
const editing = reactive({} as models.Document);
const action = ref<'edit' | null>(null);
const attachmentAction = ref<'add' | 'edit' | null>(null);
const attachmentUploading = computed(() => attachmentAction.value !== null);
const attachment = reactive({} as { description: string; urls: string[]; index: number });
const attachmentDraggable = ref(true);
const editingPublishedAt = ref(false);
const publishedDate = ref('');
const publishedTime = ref('');

async function update() {
  Loading.show();
  try {
    await setDoc(doc(documentsCollection(), (docu.value as any).id), editing);
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
  action.value = null;
  Notify.create({
    message: '編輯成功',
    color: 'positive',
  });
}

function edit() {
  Object.assign(editing, docu.value);
  action.value = 'edit';
}

function editContent() {
  content.value = (docu.value as any).content;
  editingContent.value = true;
}

function editPublishedAt() {
  publishedDate.value = date.formatDate(docu.value?.publishedAt, 'YYYY-MM-DD');
  publishedTime.value = date.formatDate(docu.value?.publishedAt, 'HH:mm');
  editingPublishedAt.value = true;
}

async function submitContent() {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      content: content.value,
    });
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
  editingContent.value = false;
}

async function publish() {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      published: true,
      publishedAt: new Date(),
    });
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '發布失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '發布成功',
    color: 'positive',
  });
  await router.push(`/document/${(docu.value as any).id}`);
}

async function retract() {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      published: false,
      publishedAt: null,
    });
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '撤回失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '撤回成功',
    color: 'positive',
  });
}

async function remove() {
  Loading.show();
  try {
    await deleteDoc(doc(documentsCollection(), (docu.value as any).id));
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '刪除失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '刪除成功',
    color: 'positive',
  });
  await router.push('/manage/document/');
}

function uploadAttachment(a?: Attachment) {
  if (a) {
    attachment.description = a.description;
    attachment.urls = a.urls;
    attachment.index = docu.value!.attachments.findIndex((x) => x === a);
    attachmentAction.value = 'edit';
  } else {
    attachment.urls = [];
    attachment.description = '';
    attachmentAction.value = 'add';
  }
}

async function submitAttachment() {
  Loading.show();
  try {
    if (attachmentAction.value === 'add') {
      await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
        attachments: arrayUnion(attachment),
      });
    } else if (attachmentAction.value === 'edit') {
      docu.value!.attachments[attachment.index] = attachment;
      await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
        attachments: docu.value!.attachments,
      });
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '上傳失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '上傳成功',
    color: 'positive',
  });
  attachmentAction.value = null;
}

async function removeAttachment(a: Attachment) {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      attachments: arrayRemove(a),
    });
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '刪除附件失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '刪除附件成功',
    color: 'positive',
  });
}

async function rearrangeAttachment() {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), route.params.id! as string), {
      attachments: docu.value!.attachments,
    });
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '重新排序失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '附件已重新排序',
    color: 'positive',
  });
}

async function submitPublishedAt() {
  Loading.show();
  try {
    const date = new Date(`${publishedDate.value}T${publishedTime.value}`);
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      publishedAt: date,
      reign: getReign(date),
    });
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
  editingPublishedAt.value = false;
}
</script>

<style scoped></style>
