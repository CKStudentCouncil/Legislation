<template>
  <q-dialog v-model="dialogModel" persistent>
    <q-card style="min-width: min(640px, 95vw)">
      <q-card-section>
        <div class="text-h5 q-ma-none">管理協作者</div>
        <div class="text-caption text-grey-7">依角色或電子郵件授予權限。權限由低至高：檢視者 → 編輯者 → 管理者。</div>
      </q-card-section>
      <q-card-section style="max-height: 70vh; overflow-y: auto">
        <div class="text-subtitle1 q-mt-sm">檢視者（可閱覽）</div>
        <q-select
          v-model="viewerRoles"
          label="檢視角色（可多選）"
          :option-label="(o) => o.translation"
          :options="roleOptions"
          multiple
          use-chips
        />
        <div class="q-mt-xs q-mb-xs text-grey-7">檢視者電子郵件</div>
        <ListEditor v-model="viewerEmails" />

        <q-separator class="q-my-md" />
        <div class="text-subtitle1">編輯者（可編輯內容與資訊）</div>
        <q-select
          v-model="editorRoles"
          label="編輯角色（可多選）"
          :option-label="(o) => o.translation"
          :options="roleOptions"
          multiple
          use-chips
        />
        <div class="q-mt-xs q-mb-xs text-grey-7">編輯者電子郵件</div>
        <ListEditor v-model="editorEmails" />

        <q-separator class="q-my-md" />
        <div class="text-subtitle1">管理者（可編輯並管理協作者）</div>
        <q-select
          v-model="managerRoles"
          label="管理角色（可多選）"
          :option-label="(o) => o.translation"
          :options="roleOptions"
          multiple
          use-chips
        />
        <div class="q-mt-xs q-mb-xs text-grey-7">管理者電子郵件</div>
        <ListEditor v-model="managerEmails" />

        <template v-if="isOwner">
          <q-separator class="q-my-md" />
          <div class="text-subtitle1 text-negative">轉移所有權</div>
          <div class="text-caption text-grey-7 q-mb-xs">將擁有者變更為其他人。原擁有者會被加入管理者以保留權限。</div>
          <div class="row q-gutter-sm items-center">
            <q-input v-model="transferEmail" class="col" label="新擁有者電子郵件" type="email" dense />
            <q-btn color="negative" label="轉移" :disable="!transferEmail" @click="confirmTransfer = true" />
          </div>
        </template>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="dialogModel = false" />
        <q-btn color="positive" flat label="儲存" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="confirmTransfer">
    <q-card>
      <q-card-section>確認將所有權轉移給 {{ transferEmail }}？此操作無法復原。</q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="取消" @click="confirmTransfer = false" />
        <q-btn color="negative" flat label="確認轉移" @click="transferOwnership" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { doc as firestoreDoc, updateDoc } from 'firebase/firestore';
import { documentsCollection } from 'src/ts/model-converters.ts';
import { DocumentSpecificIdentity } from 'src/ts/models.ts';
import type * as models from 'src/ts/models.ts';
import ListEditor from 'components/ListEditor.vue';
import { stamp } from 'pages/manage/document/common.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { Loading } from 'quasar';

const props = defineProps<{
  modelValue: boolean;
  doc: models.Document;
  docId: string;
  isOwner: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const dialogModel = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const roleOptions = Object.values(DocumentSpecificIdentity.VALUES);
type Identity = (typeof roleOptions)[number];

const viewerRoles = ref<Identity[]>([]);
const viewerEmails = ref<string[]>([]);
const editorRoles = ref<Identity[]>([]);
const editorEmails = ref<string[]>([]);
const managerRoles = ref<Identity[]>([]);
const managerEmails = ref<string[]>([]);
const transferEmail = ref('');
const confirmTransfer = ref(false);

// `viewers` is stored as Identity instances on the model; the editor/manager role arrays are raw
// firebase strings. Normalize all three to instances for the selects.
function toIdentities(values: (string | Identity)[] | undefined): Identity[] {
  return (values ?? [])
    .map((v) => (typeof v === 'string' ? DocumentSpecificIdentity.VALUES[v] : v))
    .filter((v): v is Identity => !!v);
}

watch(
  () => [props.modelValue, props.doc] as const,
  ([open]) => {
    if (!open) return;
    viewerRoles.value = toIdentities(props.doc.viewers);
    viewerEmails.value = [...(props.doc.viewerEmails ?? [])];
    editorRoles.value = toIdentities(props.doc.editorRoles);
    editorEmails.value = [...(props.doc.editorEmails ?? [])];
    managerRoles.value = toIdentities(props.doc.managerRoles);
    managerEmails.value = [...(props.doc.managerEmails ?? [])];
    transferEmail.value = '';
  },
  { immediate: true },
);

async function save() {
  Loading.show();
  try {
    await updateDoc(firestoreDoc(documentsCollection(), props.docId), {
      viewers: viewerRoles.value.map((r) => r.firebase),
      viewerEmails: [...viewerEmails.value],
      editorRoles: editorRoles.value.map((r) => r.firebase),
      editorEmails: [...editorEmails.value],
      managerRoles: managerRoles.value.map((r) => r.firebase),
      managerEmails: [...managerEmails.value],
      ...stamp(),
    });
  } catch (e) {
    notifyError('儲存協作者失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('已更新協作者');
  dialogModel.value = false;
}

async function transferOwnership() {
  const newOwner = transferEmail.value.trim();
  if (!newOwner) return;
  const oldOwner = props.doc.authorEmail;
  // Keep the previous owner as a manager so they don't lose access.
  const managers = new Set([...managerEmails.value]);
  if (oldOwner && oldOwner !== 'legacy') managers.add(oldOwner);
  managers.delete(newOwner);
  Loading.show();
  try {
    await updateDoc(firestoreDoc(documentsCollection(), props.docId), {
      authorEmail: newOwner,
      managerEmails: [...managers],
      ...stamp(),
    });
  } catch (e) {
    notifyError('轉移所有權失敗', e);
    Loading.hide();
    return;
  }
  Loading.hide();
  notifySuccess('已轉移所有權');
  confirmTransfer.value = false;
  dialogModel.value = false;
}
</script>

<style scoped></style>
