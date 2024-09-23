<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!legislation">查無此法 (或載入中)</div>
    <div v-if="legislation" style="max-width: 1170px">
      <div class="text-h4 flex-center q-pb-md text-center">
        (編輯中)
        {{ legislation.name }}
        <q-btn dense flat icon="link" size="20px" @click="copyLink()"></q-btn>
      </div>
      <div class="text-h6">立法沿革</div>
      <q-btn color="positive" flat icon="add" label="新增立法沿革" @click="addHistory"></q-btn>
      <div v-for="history of legislation.history" :key="history.amendedAt.valueOf()">
        {{ history.amendedAt.toLocaleDateString() + ' ' + history.brief }}
        <q-btn v-if="history.link" dense flat icon="open_in_new" size="10px">
          <q-tooltip>檢視發布公文</q-tooltip>
        </q-btn>
        <q-btn dense flat icon="edit" size="10px" @click="editHistory(history)" />
        <q-btn dense color="negative" flat icon="delete" size="10px" @click="removeHistory(history)" />
      </div>
      <q-btn color="positive" flat icon="add" label="新增內容" @click="addContent"></q-btn>
      <VueDraggable ref="el" v-model="legislation.content" class="q-gutter-md" style="cursor: move" @update="rearrange">
        <div v-for="content of legislation.content" :id="content.index.toString()" :key="content.index" class="row">
          <q-icon class="col self-center q-mr-sm" name="drag_indicator" style="max-width: 10px">
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
    </div>
  </q-page>
  <q-dialog :model-value="contentAction != null" persistent>
    <q-card style="min-width: 80vw">
      <q-card-section>
        <q-select
          v-model="targetContent.type"
          :option-label="(o) => o.translation"
          :options="Object.values(models.ContentType.VALUES)"
          label="類型"
          @update:model-value="generateTitle"
        />
        <q-input v-model="targetContent.title" label="標題" />
        <q-input v-model="targetContent.subtitle" :disable="targetContent.deleted" label="副標題 (無須加入中括號)" />
        <q-input v-model="targetContent.content" :disable="targetContent.deleted" label="內容" type="textarea" />
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
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router';
import * as models from 'src/ts/models.ts';
import { convertContentToFirebase, legislationDocument, useLegislation } from 'src/ts/models.ts';
import LegislationContent from 'components/LegislationContent.vue';
import { copyLink, translateNumber, translateNumberToChinese } from 'src/ts/utils.ts';
import { date, Loading, Notify } from 'quasar';
import { arrayRemove, arrayUnion, updateDoc } from 'firebase/firestore';
import { VueDraggable } from 'vue-draggable-plus';
import { reactive, ref } from 'vue';
import ListEditor from 'components/ListEditor.vue';
import LegislationAddendum from 'components/LegislationAddendum.vue';

const route = useRoute();
const legislation = useLegislation(route.params.id! as string);
const targetContent = reactive<models.LegislationContent>({} as any);
const targetAddendum = reactive({} as { content: string[]; createdAt: string; index: number });
const targetHistory = reactive({} as { amendedAt: string; brief: string; link: string; recordCurrent: boolean; index: number });
const contentAction = ref<'edit' | 'add' | null>(null);
const addendumAction = ref<'edit' | 'add' | null>(null);
const historyAction = ref<'edit' | 'add' | null>(null);

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
  historyAction.value = 'add';
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
  historyAction.value = 'edit';
}

function generateTitle() {
  let last = 0;
  for (const content of legislation.value!.content) {
    if (content.type.firebase == targetContent.type.firebase) {
      const title = content.title.split('-')[0].match(/[\d零一二三四五六七八九十百千]+/g);
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

async function submitContent() {
  Loading.show();
  targetContent.content = targetContent.content?.replaceAll(',', '，').replaceAll(';', '；');
  try {
    if (contentAction.value == 'add') {
      await updateDoc(legislationDocument(route.params.id! as string), {
        content: arrayUnion(convertContentToFirebase(targetContent)),
      });
    } else if (contentAction.value == 'edit') {
      legislation.value!.content[targetContent.index] = targetContent;
      await updateDoc(legislationDocument(route.params.id! as string), {
        content: legislation.value!.content.map(convertContentToFirebase),
      });
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '操作失敗',
      color: 'negative',
    });
    Loading.hide();
    return;
  }
  Loading.hide();
  Notify.create({
    message: '操作成功',
    color: 'positive',
  });
  contentAction.value = null;
}

async function submitAddendum() {
  Loading.show();
  try {
    const mappedAddendum = {
      content: targetAddendum.content,
      createdAt: date.extractDate(targetAddendum.createdAt, 'YYYY-MM-DD'), // already utc
    };
    if (addendumAction.value == 'add') {
      await updateDoc(legislationDocument(route.params.id! as string), {
        addendum: arrayUnion(mappedAddendum),
      });
    } else if (addendumAction.value == 'edit') {
      if (!legislation.value!.addendum) {
        legislation.value!.addendum = [];
      }
      legislation.value!.addendum[targetAddendum.index] = mappedAddendum;
      console.log(legislation.value!.addendum);
      await updateDoc(legislationDocument(route.params.id! as string), {
        addendum: legislation.value!.addendum,
      });
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '操作失敗',
      color: 'negative',
    });
    return;
  } finally {
    Loading.hide();
  }
  Notify.create({
    message: '操作成功',
    color: 'positive',
  });
  addendumAction.value = null;
}

async function submitHistory() {
  Loading.show();
  try {
    const mappedHistory = {
      amendedAt: date.extractDate(targetHistory.amendedAt, 'YYYY-MM-DD'),
      brief: targetHistory.brief,
    } as models.History;
    if (targetHistory.link) {
      mappedHistory.link = targetHistory.link;
    }
    if (targetHistory.recordCurrent) {
      mappedHistory.content = legislation.value!.content.map(convertContentToFirebase);
    }
    if (historyAction.value == 'add') {
      await updateDoc(legislationDocument(route.params.id! as string), {
        history: arrayUnion(mappedHistory),
      });
    } else if (historyAction.value == 'edit') {
      legislation.value!.history[targetHistory.index] = mappedHistory;
      await updateDoc(legislationDocument(route.params.id! as string), {
        history: legislation.value!.history,
      });
    }
  } catch (e) {
    console.error(e);
    Notify.create({
      message: '操作失敗',
      color: 'negative',
    });
    return;
  } finally {
    Loading.hide();
  }
  Notify.create({
    message: '操作成功',
    color: 'positive',
  });
  historyAction.value = null;
}

async function removeContent(content: models.LegislationContent) {
  Loading.show();
  try {
    await updateDoc(legislationDocument(route.params.id! as string), {
      content: arrayRemove(convertContentToFirebase(content)),
    });
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
    message: '提案已刪除',
    color: 'positive',
  });
}

async function removeAddendum(addendum: models.Addendum) {
  Loading.show();
  try {
    await updateDoc(legislationDocument(route.params.id! as string), {
      addendum: arrayRemove(addendum),
    });
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
    message: '附帶決議已刪除',
    color: 'positive',
  });
}

async function removeHistory(history: models.History) {
  Loading.show();
  try {
    await updateDoc(legislationDocument(route.params.id! as string), {
      history: arrayRemove(history),
    });
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
    message: '立法沿革已刪除',
    color: 'positive',
  });
}

async function rearrange() {
  Loading.show();
  try {
    for (let i = 0; i < legislation.value!.content.length; i++) {
      legislation.value!.content[i].index = i;
    }
    await updateDoc(legislationDocument(route.params.id! as string), {
      content: legislation.value!.content.map(convertContentToFirebase),
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
    message: '提案已重新排序',
    color: 'positive',
  });
}
</script>

<style scoped></style>
