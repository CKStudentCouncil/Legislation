<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!docu">載入中...(或查無此公文)</div>
    <div v-else style="max-width: min(1170px, 97vw)">
      <div class="q-gutter-md q-mb-md">
        <q-btn color="positive" icon="edit" label="編輯資訊" @click="edit" />
        <q-btn color="primary" icon="edit" label="編輯內文" @click="editContent" />
        <q-btn color="accent" icon="attachment" label="上傳附件" @click="uploadAttachment()" />
        <q-btn-dropdown color="warning" icon="settings" label="進階功能">
          <div class="q-gutter-sm col">
            <q-btn class="bg-amber-8 row" icon="schedule" label="發布時間" @click="editPublishedAt()" />
            <q-btn class="bg-green-8 row" icon="123" label="公文字號" @click="editId()" />
          </div>
        </q-btn-dropdown>
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
        <DocumentSeparator/>
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
      <q-card-section style="max-height: 80vh; overflow-y: auto">
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
        <AttachmentUploader ref="attachmentUploader" :filenamePrefix="`${route.params.id}_附件_`" @uploaded="(u) => attachment.urls.push(...u)" />
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
  <q-dialog v-model="editingId">
    <q-card>
      <q-card-section>
        <div class="text-h5 q-ma-none">編輯公文字號</div>
      </q-card-section>
      <q-card-section>
        <q-input v-model="editingIdPrefix" label="新公文字首 (例：建班主令字)" />
        <q-input v-model="editingIdNumber" label="新公文字號 (例：07910000001)" />
        <div>新公文字號預覽：</div>
        <div class="text-h6">{{ editingIdPrefix }}第{{ editingIdNumber }}號</div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="editingId = false" />
        <q-btn color="positive" flat label="確定" @click="submitId()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <DocumentDialog v-model="editing" :action="action" @canceled="action = null" @submit="update" />
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import type { Attachment} from 'src/ts/models.ts';
import { documentsCollection } from 'src/ts/models.ts';
import { arrayRemove, arrayUnion, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { date, Loading, useQuasar } from 'quasar';
import ProEditor from 'components/ProEditor.vue';
import { computed, reactive, ref } from 'vue';
import DocumentDialog from 'components/DocumentDialog.vue';
import type * as models from 'src/ts/models';
import AttachmentUploader from 'components/AttachmentUploader.vue';
import ListEditor from 'components/ListEditor.vue';
import { VueDraggable } from 'vue-draggable-plus';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import DocumentRenderer from 'components/documents/DocumentRenderer.vue';
import { getReign, notifyError, notifySuccess } from 'src/ts/utils.ts';
import { useDocument } from 'vuefire';
import { useFunction } from 'boot/vuefire.ts';
import DocumentSeparator from 'components/DocumentSeparator.vue';

const route = useRoute();
const router = useRouter();
const docuId = computed(() => doc(documentsCollection(), route.params.id! as string)); // dynamic id so we can auto reload during an id change
const docu = useDocument(docuId);
const content = ref('');
const editingContent = ref(false);
const editing = reactive({} as models.Document);
const action = ref<'edit' | null>(null);
const attachmentAction = ref<'add' | 'edit' | null>(null);
const attachmentUploading = computed(() => attachmentAction.value !== null);
const attachment = reactive({} as { description: string; urls: string[]; index: number });
const attachmentDraggable = ref(!useQuasar().platform.is.mobile);
const attachmentUploader = ref<InstanceType<typeof AttachmentUploader> | null>(null);
const editingPublishedAt = ref(false);
const publishedDate = ref('');
const publishedTime = ref('');
const editingId = ref(false);
const editingIdPrefix = ref('');
const editingIdNumber = ref('');

async function update() {
  Loading.show();
  try {
    await setDoc(doc(documentsCollection(), (docu.value as any).id), editing);
  } catch (e) {
    notifyError('編輯失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  action.value = null;
  notifySuccess('編輯成功');
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
  publishedDate.value = date.formatDate(docu.value?.publishedAt ?? new Date(), 'YYYY-MM-DD');
  publishedTime.value = date.formatDate(docu.value?.publishedAt ?? new Date(), 'HH:mm');
  editingPublishedAt.value = true;
}

async function submitContent() {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      content: content.value,
    });
  } catch (e) {
    notifyError('編輯失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('編輯成功');
  editingContent.value = false;
}

async function publish() {
  Loading.show({ message: '更改公開狀態' });
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      published: true,
      publishedAt: new Date(),
    });
    Loading.show({ message: '寄發通知郵件' });
    await useFunction('publishDocument')({ docId: (docu.value as any).id });
  } catch (e) {
    notifyError('發布失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功發布公文');
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
    notifyError('撤回失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功撤回公文');
}

async function remove() {
  Loading.show();
  try {
    await deleteDoc(doc(documentsCollection(), (docu.value as any).id));
  } catch (e) {
    notifyError('刪除失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功刪除公文');
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
  if (!attachmentUploader.value?.check()) {
    return;
  }
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
    notifyError('上傳附件失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('上傳成功');
  attachmentAction.value = null;
}

async function removeAttachment(a: Attachment) {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), (docu.value as any).id), {
      attachments: arrayRemove(a),
    });
  } catch (e) {
    notifyError('刪除附件失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('刪除附件成功');
}

async function rearrangeAttachment() {
  Loading.show();
  try {
    await updateDoc(doc(documentsCollection(), route.params.id! as string), {
      attachments: docu.value!.attachments,
    });
  } catch (e) {
    notifyError('重新排序失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功重新排序附件');
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
    notifyError('編輯失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('編輯成功');
  editingPublishedAt.value = false;
}

function editId() {
  editingIdPrefix.value = (docu.value as any).idPrefix;
  editingIdNumber.value = (docu.value as any).idNumber;
  editingId.value = true;
}

async function submitId() {
  Loading.show();
  const oldId = (docu.value as any).id;
  docu.value!.idPrefix = editingIdPrefix.value;
  docu.value!.idNumber = editingIdNumber.value;
  const newId = `${editingIdPrefix.value}第${editingIdNumber.value}號`;
  try {
    await setDoc(doc(documentsCollection(), newId), docu.value);
    await router.push(newId);
    await deleteDoc(doc(documentsCollection(), oldId));
  } catch (e) {
    notifyError('編輯失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('編輯成功');
  editingId.value = false;
}
</script>

<style scoped></style>
