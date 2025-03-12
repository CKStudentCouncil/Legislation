<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!legislation">查無此法 (或載入中)</div>
    <div v-if="legislation" style="max-width: 1170px">
      <div class="text-h4 flex-center q-pb-md text-center">
        (編輯中)
        {{ legislation.name }}
        <q-btn dense flat icon="link" size="20px" @click="copyLink()"></q-btn>
        <q-btn dense flat icon="edit" size="20px" @click="edit()"></q-btn>
        <q-btn color="negative" dense flat icon="delete" size="20px" @click="remove()"></q-btn>
      </div>
      <div v-if="legislation.preface">{{ legislation.preface }}</div>
      <div class="text-h6">立法沿革</div>
      <q-btn color="positive" flat icon="add" label="新增立法沿革" @click="addHistory"></q-btn>
      <div v-for="history of legislation.history.sort((a, b) => a.amendedAt.valueOf() - b.amendedAt.valueOf())" :key="history.amendedAt.valueOf()">
        {{ history.amendedAt.toLocaleDateString() + ' ' + history.brief }}
        <q-btn v-if="history.link" dense flat icon="open_in_new" size="10px">
          <q-tooltip>檢視發布公文</q-tooltip>
        </q-btn>
        <q-btn dense flat icon="edit" size="10px" @click="editHistory(history)" />
        <q-btn color="negative" dense flat icon="delete" size="10px" @click="removeHistory(history)" />
      </div>
      <q-btn color="positive" flat icon="add" label="新增內容" @click="addContent"></q-btn>
      <q-toggle v-model="draggable.content" label="拖曳排序" />
      <VueDraggable
        ref="el"
        v-model="legislation.content"
        :disabled="!draggable.content"
        :style="draggable.content ? 'cursor: move' : ''"
        class="q-gutter-md"
        @update="rearrange"
      >
        <div v-for="content of legislation.content" :id="content.index.toString()" :key="content.index" class="row">
          <q-icon v-if="draggable.content" class="col self-center q-mr-sm" name="drag_indicator" style="max-width: 10px">
            <q-tooltip>拖曳以重新排序</q-tooltip>
          </q-icon>
          <LegislationContent :content="content" class="col" />
          <q-btn flat icon="edit" size="10px" @click="editContent(content)" />
          <q-btn color="negative" flat icon="delete" size="10px" @click="removeContent(content)" />
        </div>
      </VueDraggable>
      <div>
        <div class="text-h5">附帶決議</div>
        <q-btn color="positive" flat icon="add" label="新增項目" @click="addAddendum"></q-btn>
        <div
          v-for="addendum of legislation.addendum?.sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf())"
          :key="addendum.createdAt.valueOf()"
        >
          <LegislationAddendum :addendum="addendum" editable @edit="editAddendum" @remove="removeAddendum" />
        </div>
      </div>
      <div>
        <div class="text-h5">附件</div>
        <q-btn color="positive" flat icon="add" label="新增附件" @click="addAttachment"></q-btn>
        <q-toggle v-model="draggable.attachment" label="拖曳排序" />
        <VueDraggable
          v-if="legislation.attachments"
          ref="el"
          v-model="legislation.attachments!"
          :disabled="!draggable.attachment"
          :style="draggable.attachment ? 'cursor: move' : ''"
          class="q-gutter-md"
          @update="rearrangeAttachment"
        >
          <div v-for="(attachment, index) of legislation.attachments" :key="attachment.description + attachment.urls.toString()" class="row">
            <q-icon v-if="draggable.attachment" class="col self-center q-mr-sm" name="drag_indicator" style="max-width: 10px">
              <q-tooltip>拖曳以重新排序</q-tooltip>
            </q-icon>
            <AttachmentDisplay :attachment="attachment" :order="index + 1" class="col" />
            <q-btn flat icon="edit" size="10px" @click="editAttachment(attachment)" />
            <q-btn color="negative" flat icon="delete" size="10px" @click="removeAttachment(attachment)" />
          </div>
        </VueDraggable>
      </div>
    </div>
  </q-page>
  <q-dialog :model-value="contentAction != null" persistent>
    <q-card style="min-width: 80vw">
      <q-card-section>
        <q-select
          v-model="targetContent.type"
          :option-label="(o) => o.translation + (o.firebase == ContentType.SpecialClause.firebase ? ' (訴訟典)' : '')"
          :options="Object.values(models.ContentType.VALUES)"
          label="類型"
          @update:model-value="generateTitle"
        />
        <q-input v-model="targetContent.title" label="標題" />
        <q-input v-model="targetContent.subtitle" :disable="targetContent.deleted" label="副標題 (無須加入中括號)" />
        <q-input
          v-if="targetContent.type.firebase != ContentType.Chapter.firebase"
          v-model="targetContent.content"
          :disable="targetContent.deleted"
          label="內容"
          type="textarea"
        />
        <q-checkbox v-model="targetContent.deleted" label="刪除" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup color="negative" flat label="取消" @click="contentAction = null" />
        <q-btn v-close-popup color="positive" flat label="確定" @click="submitContent" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog :model-value="addendumAction != null" persistent>
    <q-card style="min-width: 30vw">
      <q-card-section>
        <q-date v-model="targetAddendum.createdAt" class="q-mb-md" label="日期" mask="YYYY-MM-DD" />
        <br />
        <ListEditor v-model="targetAddendum.content" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup color="negative" flat label="取消" @click="addendumAction = null" />
        <q-btn v-close-popup color="positive" flat label="確定" @click="submitAddendum" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog :model-value="historyAction != null" persistent>
    <q-card style="min-width: 30vw">
      <q-card-section>
        <q-date v-model="targetHistory.amendedAt" class="q-mb-md" label="日期" mask="YYYY-MM-DD" />
        <q-input v-model="targetHistory.brief" label="簡述" />
        <q-input v-model="targetHistory.link" label="發布公文連結" />
        <q-checkbox v-model="targetHistory.recordCurrent" label="記錄目前法條內容為修改後內容" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup color="negative" flat label="取消" @click="historyAction = null" />
        <q-btn v-close-popup color="positive" flat label="確定" @click="submitHistory" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog :model-value="attachmentAction != null" persistent>
    <q-card style="min-width: 30vw">
      <q-card-section>
        <q-input v-model="targetAttachment.description" label="說明" type="textarea" />
        <ListEditor v-model="targetAttachment.urls" />
        <AttachmentUploader ref="attachmentUploader" :filename-prefix="legislation?.name + '_附件_'" @uploaded="(s) => targetAttachment.urls.push(...s)" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup color="negative" flat label="取消" @click="attachmentAction = null" />
        <q-btn v-close-popup color="positive" flat label="確定" @click="submitAttachment" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <LegislationDialog v-model="target" :action="action" @canceled="action = null" @submit="submit" />
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import * as models from 'src/ts/models.ts';
import type { LegislationCategory} from 'src/ts/models.ts';
import { ContentType, convertContentToFirebase, legislationDocument, useLegislation } from 'src/ts/models.ts';
import LegislationContent from 'components/LegislationContent.vue';
import { copyLink, notifyError, notifySuccess, translateNumber, translateNumberToChinese } from 'src/ts/utils.ts';
import { date, Dialog, Loading } from 'quasar';
import { arrayRemove, arrayUnion, deleteDoc, updateDoc } from 'firebase/firestore';
import { VueDraggable } from 'vue-draggable-plus';
import type { Ref} from 'vue';
import { reactive, ref } from 'vue';
import ListEditor from 'components/ListEditor.vue';
import LegislationAddendum from 'components/LegislationAddendum.vue';
import LegislationDialog from 'components/LegislationDialog.vue';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import AttachmentUploader from 'components/AttachmentUploader.vue';

const route = useRoute();
const router = useRouter();
const legislation = useLegislation(route.params.id! as string);
const targetContent = reactive<models.LegislationContent>({} as any);
const targetAddendum = reactive({} as { content: string[]; createdAt: string; index: number });
const targetHistory = reactive(
  {} as {
    amendedAt: string;
    brief: string;
    link: string;
    recordCurrent: boolean;
    index: number;
    content: models.LegislationContent[];
  },
);
const targetAttachment = reactive({} as { description: string; urls: string[]; index: number });
const target = reactive({} as { name: string; category: LegislationCategory; createdAt: string; preface?: string });
const contentAction = ref<'edit' | 'add' | null>(null);
const addendumAction = ref<'edit' | 'add' | null>(null);
const historyAction = ref<'edit' | 'add' | null>(null);
const attachmentAction = ref<'edit' | 'add' | null>(null);
const attachmentUploader = ref<InstanceType<typeof AttachmentUploader> | null>(null);
const action = ref<'edit' | null>(null);
const draggable = reactive({ content: true, attachment: true });

function addContent() {
  targetContent.type = models.ContentType.Clause;
  targetContent.deleted = false;
  targetContent.index = legislation.value!.content.length;
  targetContent.subtitle = '';
  targetContent.content = '';
  generateTitle();
  contentAction.value = 'add';
}

function addAddendum() {
  targetAddendum.content = [];
  targetAddendum.createdAt = date.formatDate(new Date(), 'YYYY-MM-DD');
  addendumAction.value = 'add';
}

function addHistory() {
  targetHistory.amendedAt = date.formatDate(new Date(), 'YYYY-MM-DD');
  targetHistory.brief = '';
  targetHistory.link = '';
  targetHistory.recordCurrent = true;
  targetHistory.content = [];
  historyAction.value = 'add';
}

function addAttachment() {
  targetAttachment.description = '';
  targetAttachment.urls = [];
  attachmentAction.value = 'add';
}

function editContent(legislationContent: models.LegislationContent) {
  targetContent.type = legislationContent.type;
  targetContent.deleted = legislationContent.deleted;
  targetContent.index = legislationContent.index;
  targetContent.title = legislationContent.title;
  targetContent.subtitle = legislationContent.subtitle;
  targetContent.content = legislationContent.content;
  contentAction.value = 'edit';
}

function editAddendum(addendum: models.Addendum) {
  targetAddendum.content = addendum.content.slice(); // Clone
  targetAddendum.createdAt = date.formatDate(addendum.createdAt, 'YYYY-MM-DD');
  targetAddendum.index = legislation.value!.addendum!.indexOf(addendum);
  addendumAction.value = 'edit';
}

function editHistory(history: models.History) {
  targetHistory.amendedAt = date.formatDate(history.amendedAt, 'YYYY-MM-DD');
  targetHistory.brief = history.brief;
  targetHistory.link = history.link ?? '';
  targetHistory.recordCurrent = false;
  targetHistory.index = legislation.value!.history.indexOf(history);
  targetHistory.content = history.content?.slice() ?? []; // Clone
  historyAction.value = 'edit';
}

function editAttachment(attachment: models.Attachment) {
  targetAttachment.description = attachment.description;
  targetAttachment.urls = attachment.urls.slice(); // Clone
  targetAttachment.index = legislation.value!.attachments!.indexOf(attachment);
  attachmentAction.value = 'edit';
}

function edit() {
  target.name = legislation.value!.name;
  target.category = legislation.value!.category;
  target.createdAt = date.formatDate(legislation.value!.createdAt, 'YYYY-MM-DD');
  target.preface = legislation.value!.preface ?? '';
  action.value = 'edit';
}

function generateTitle() {
  let last = 0;
  for (const content of legislation.value!.content) {
    if (content.type.firebase == targetContent.type.firebase) {
      const title = content.title.split('-')[0]?.match(/[\d零一二三四五六七八九十百千]+/g);
      if (title) {
        const count = parseInt(title[0].replace(/[零一二三四五六七八九十百千]+/g, (c) => translateNumber(c).toString()));
        if (count > last) {
          last = count;
        }
      }
    }
  }
  targetContent.title = `第 ${targetContent.type.arabicOrdinal ? last + 1 : translateNumberToChinese(last + 1)} ${targetContent.type.translation}`;
}

async function submitProperty(determinant: Ref<'edit' | 'add' | null>, addCallback: () => Promise<void>, editCallback: () => Promise<void>) {
  Loading.show();
  try {
    if (determinant.value == 'add') {
      await addCallback();
    } else if (determinant.value == 'edit') {
      await editCallback();
    }
  } catch (e) {
    notifyError('操作失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('操作成功');
  determinant.value = null;
}

async function submitContent() {
  targetContent.content = targetContent.content?.replaceAll(',', '，').replaceAll(';', '；').trim();
  targetContent.subtitle = targetContent.subtitle?.replaceAll('【', '').replaceAll('】', '');
  await submitProperty(
    contentAction,
    async () => {
      await updateDoc(legislationDocument(route.params.id! as string), {
        content: arrayUnion(convertContentToFirebase(targetContent)),
      });
    },
    async () => {
      legislation.value!.content[targetContent.index] = targetContent;
      await updateDoc(legislationDocument(route.params.id! as string), {
        content: legislation.value!.content.map(convertContentToFirebase),
      });
    },
  );
}

async function submitAddendum() {
  const mappedAddendum = {
    content: targetAddendum.content,
    createdAt: date.extractDate(targetAddendum.createdAt, 'YYYY-MM-DD'), // already utc
  };
  await submitProperty(
    addendumAction,
    async () => {
      await updateDoc(legislationDocument(route.params.id! as string), {
        addendum: arrayUnion(mappedAddendum),
      });
    },
    async () => {
      if (!legislation.value!.addendum) {
        legislation.value!.addendum = [];
      }
      legislation.value!.addendum[targetAddendum.index] = mappedAddendum;
      await updateDoc(legislationDocument(route.params.id! as string), {
        addendum: legislation.value!.addendum,
      });
    },
  );
}

async function submitHistory() {
  const mappedHistory = {
    amendedAt: date.extractDate(targetHistory.amendedAt, 'YYYY-MM-DD'),
    brief: targetHistory.brief,
    content: targetHistory.content,
  } as models.History;
  if (targetHistory.link) {
    mappedHistory.link = targetHistory.link;
  }
  if (targetHistory.recordCurrent) {
    mappedHistory.content = legislation.value!.content;
  }
  await submitProperty(
    historyAction,
    async () => {
      mappedHistory.content = mappedHistory.content?.map(convertContentToFirebase);
      await updateDoc(legislationDocument(route.params.id! as string), {
        history: arrayUnion(mappedHistory),
      });
    },
    async () => {
      legislation.value!.history[targetHistory.index] = mappedHistory;
      await updateDoc(legislationDocument(route.params.id! as string), {
        history: legislation.value!.history.map((h) => {
          const copy = { ...h };
          copy.content = copy.content?.map(convertContentToFirebase);
          return copy;
        }),
      });
    },
  );
}

async function submitAttachment() {
  if (!attachmentUploader.value?.check()) {
    return;
  }
  await submitProperty(
    attachmentAction,
    async () => {
      await updateDoc(legislationDocument(route.params.id! as string), {
        attachments: arrayUnion(targetAttachment),
      });
    },
    async () => {
      if (!legislation.value!.attachments) {
        legislation.value!.attachments = [];
      }
      legislation.value!.attachments[targetAttachment.index] = targetAttachment;
      await updateDoc(legislationDocument(route.params.id! as string), {
        attachments: legislation.value!.attachments,
      });
    },
  );
}

async function submit() {
  await submitProperty(
    action,
    async () => {},
    async () => {
      const data = {
        name: target.name,
        category: target.category.firebase,
        createdAt: date.extractDate(target.createdAt, 'YYYY-MM-DD'),
      } as any;
      if (target.preface) {
        data.preface = target.preface;
      }
      await updateDoc(legislationDocument(route.params.id! as string), data);
    },
  );
}

function removeProperty(property: string, object: object, translation: string) {
  Dialog.create({
    title: `刪除${translation}`,
    message: `確定要刪除此${translation}嗎？`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await updateDoc(legislationDocument(route.params.id! as string), { [property]: arrayRemove(object) });
    } catch (e) {
      notifyError('刪除失敗', e);
      Loading.hide();
      return;
    }
    Loading.hide();
    notifySuccess(`成功刪除${translation}`);
  });
}

function removeContent(content: models.LegislationContent) {
  const copy = { ...content };
  copy.type = content.type.firebase as any;
  removeProperty('content', content, '內容');
}

function removeAddendum(addendum: models.Addendum) {
  removeProperty('addendum', addendum, '附帶決議');
}

function removeHistory(history: models.History) {
  const copy = { ...history };
  copy.content = copy.content?.map(convertContentToFirebase);
  removeProperty('history', history, '立法沿革');
}

function removeAttachment(attachment: models.Attachment) {
  removeProperty('attachments', attachment, '附件');
}

function remove() {
  Dialog.create({
    title: '刪除法案',
    message: '確定要刪除此法案嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await deleteDoc(legislationDocument(route.params.id! as string));
      await router.push('/manage/legislation');
    } catch (e) {
      notifyError('刪除失敗', e);
      Loading.hide();
      return;
    }
    Loading.hide();
    notifySuccess('成功刪除法案');
  });
}

async function rearrange() {
  Loading.show();
  try {
    for (let i = 0; i < legislation.value!.content.length; i++) {
      legislation.value!.content[i]!.index = i;
    }
    await updateDoc(legislationDocument(route.params.id! as string), {
      content: legislation.value!.content.map(convertContentToFirebase),
    });
  } catch (e) {
    notifyError('重新排序失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('內容已重新排序');
}

async function rearrangeAttachment() {
  Loading.show();
  try {
    await updateDoc(legislationDocument(route.params.id! as string), {
      attachments: legislation.value!.attachments,
    });
  } catch (e) {
    notifyError('重新排序失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('成功重新排序附件');
}
</script>

<style scoped></style>
