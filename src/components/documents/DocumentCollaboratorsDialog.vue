<template>
  <q-dialog v-model="dialogModel" persistent>
    <q-card style="min-width: min(680px, 95vw)">
      <q-card-section>
        <div class="text-h5 q-ma-none">管理協作者</div>
        <div class="text-caption text-grey-7">
          以電子郵件或角色授予存取權限。權限由低至高：檢視者（可閱覽）→ 編輯者（可編輯內容與資訊）→ 管理者（可編輯並管理協作者）。
        </div>
      </q-card-section>

      <q-card-section style="max-height: 70vh; overflow-y: auto">
        <!-- Add a grantee: choose ONE of email / role, a tier, and (for email) whether to notify -->
        <div class="text-subtitle1">新增協作者</div>
        <div class="row q-col-gutter-sm items-center">
          <div class="col-12 col-sm-auto">
            <q-btn-toggle
              v-model="addKind"
              dense
              no-caps
              :options="[
                { label: '電子郵件', value: 'email' },
                { label: '角色', value: 'role' },
              ]"
              toggle-color="primary"
            />
          </div>
          <div class="col-12 col-sm">
            <q-input
              v-if="addKind === 'email'"
              v-model="addEmail"
              dense
              label="電子郵件"
              type="email"
              @keyup.enter="addGrantee"
            />
            <q-select v-else v-model="addRole" dense label="角色" :option-label="(o) => o.translation" :options="roleOptions" />
          </div>
          <div class="col-12 col-sm-auto">
            <q-select v-model="addTier" dense emit-value label="權限" map-options :options="tierOptions" style="min-width: 110px" />
          </div>
          <div class="col-12 col-sm-auto">
            <q-btn
              color="primary"
              dense
              icon="add"
              label="新增"
              no-caps
              :disable="addKind === 'email' ? !addEmail.trim() : !addRole"
              @click="addGrantee"
            />
          </div>
        </div>
        <q-checkbox
          v-if="addKind === 'email'"
          v-model="addNotify"
          class="q-mt-xs"
          dense
          label="新增後寄送電子郵件通知給對方（系統制式通知，不含自訂訊息）"
        />

        <q-separator class="q-my-md" />

        <!-- Unified grantee list: one row per user, role chosen via the inline dropdown -->
        <div class="text-subtitle1">目前的協作者</div>
        <div v-if="grantees.length === 0" class="text-grey-7 q-pa-sm">尚無協作者。</div>
        <q-list v-else bordered class="rounded-borders" separator>
          <q-item v-for="(g, i) in grantees" :key="g.kind + ':' + g.value">
            <q-item-section avatar>
              <q-icon :name="g.kind === 'role' ? 'badge' : 'mail'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ granteeLabel(g) }}</q-item-label>
              <q-item-label caption>
                {{ g.kind === 'role' ? '角色' : '電子郵件'
                }}<span v-if="g.isNew && g.kind === 'email' && g.notify"> · 儲存後將寄送通知</span>
              </q-item-label>
            </q-item-section>
            <q-item-section side style="min-width: 120px">
              <q-select v-model="g.tier" borderless dense emit-value map-options :options="tierOptions" options-dense />
            </q-item-section>
            <q-item-section side>
              <q-btn color="negative" dense flat icon="delete" round @click="remove(i)" />
            </q-item-section>
          </q-item>
        </q-list>

        <template v-if="isOwner">
          <q-separator class="q-my-md" />
          <div class="text-subtitle1 text-negative">轉移所有權</div>
          <div class="text-caption text-grey-7 q-mb-xs">將擁有者變更為其他人。原擁有者會被加入管理者以保留權限。</div>
          <div class="row q-gutter-sm items-center">
            <q-input v-model="transferEmail" class="col" dense label="新擁有者電子郵件" type="email" />
            <q-btn color="negative" :disable="!transferEmail" label="轉移" @click="confirmTransfer = true" />
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
import { stamp } from 'pages/manage/document/common.ts';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { useFunctionAsync } from 'src/boot/vuefire.ts';
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
type Tier = 'viewer' | 'editor' | 'manager';

const tierOptions = [
  { label: '檢視者', value: 'viewer' },
  { label: '編輯者', value: 'editor' },
  { label: '管理者', value: 'manager' },
];

// One unified entry per grantee. `value` is a role firebase string (kind 'role') or an email
// (kind 'email'). `isNew`/`notify` track grants added this session that opted into a notification.
interface Grantee {
  kind: 'role' | 'email';
  value: string;
  tier: Tier;
  isNew: boolean;
  notify: boolean;
}

const grantees = ref<Grantee[]>([]);
const addKind = ref<'role' | 'email'>('email');
const addRole = ref<Identity | null>(null);
const addEmail = ref('');
const addTier = ref<Tier>('viewer');
const addNotify = ref(true);
const transferEmail = ref('');
const confirmTransfer = ref(false);

// `viewers` is persisted as Identity instances on the model; the editor/manager role arrays are raw
// firebase strings. Normalize all role lists to firebase strings.
function asFirebaseStrings(values: (string | Identity)[] | undefined): string[] {
  return (values ?? []).map((v) => (typeof v === 'string' ? v : v.firebase)).filter((v): v is string => !!v);
}

function buildList(): Grantee[] {
  const d = props.doc;
  const out: Grantee[] = [];
  const pushRoles = (vals: (string | Identity)[] | undefined, tier: Tier) =>
    asFirebaseStrings(vals).forEach((value) => out.push({ kind: 'role', value, tier, isNew: false, notify: false }));
  const pushEmails = (vals: string[] | undefined, tier: Tier) =>
    (vals ?? []).forEach((value) => out.push({ kind: 'email', value, tier, isNew: false, notify: false }));
  pushRoles(d.viewers, 'viewer');
  pushEmails(d.viewerEmails, 'viewer');
  pushRoles(d.editorRoles, 'editor');
  pushEmails(d.editorEmails, 'editor');
  pushRoles(d.managerRoles, 'manager');
  pushEmails(d.managerEmails, 'manager');
  return out;
}

watch(
  () => [props.modelValue, props.doc] as const,
  ([open]) => {
    if (!open) return;
    grantees.value = buildList();
    addKind.value = 'email';
    addRole.value = null;
    addEmail.value = '';
    addTier.value = 'viewer';
    addNotify.value = true;
    transferEmail.value = '';
  },
  { immediate: true },
);

function roleLabel(fb: string): string {
  return DocumentSpecificIdentity.VALUES[fb]?.translation ?? fb;
}
function granteeLabel(g: Grantee): string {
  return g.kind === 'role' ? roleLabel(g.value) : g.value;
}

function addGrantee() {
  if (addKind.value === 'role') {
    if (!addRole.value) return;
    const fb = addRole.value.firebase;
    const existing = grantees.value.find((g) => g.kind === 'role' && g.value === fb);
    if (existing) existing.tier = addTier.value;
    else grantees.value.push({ kind: 'role', value: fb, tier: addTier.value, isNew: true, notify: false });
    addRole.value = null;
  } else {
    const email = addEmail.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notifyError('請輸入有效的電子郵件');
      return;
    }
    const existing = grantees.value.find((g) => g.kind === 'email' && g.value === email);
    if (existing) {
      existing.tier = addTier.value;
      existing.notify = existing.notify || addNotify.value;
    } else {
      grantees.value.push({ kind: 'email', value: email, tier: addTier.value, isNew: true, notify: addNotify.value });
    }
    addEmail.value = '';
  }
}

function remove(i: number) {
  grantees.value.splice(i, 1);
}

async function save() {
  const roles = (tier: Tier) => grantees.value.filter((g) => g.kind === 'role' && g.tier === tier).map((g) => g.value);
  const emails = (tier: Tier) => grantees.value.filter((g) => g.kind === 'email' && g.tier === tier).map((g) => g.value);
  Loading.show();
  try {
    await updateDoc(firestoreDoc(documentsCollection(), props.docId), {
      viewers: roles('viewer'),
      viewerEmails: emails('viewer'),
      editorRoles: roles('editor'),
      editorEmails: emails('editor'),
      managerRoles: roles('manager'),
      managerEmails: emails('manager'),
      ...stamp(),
    });
  } catch (e) {
    notifyError('儲存協作者失敗', e);
    Loading.hide();
    return;
  }

  // Send opt-in notifications only for newly-added email grantees that requested one. A failure here
  // must not undo the (already-saved) permission change — surface it but still report success.
  const toNotify = [
    ...new Set(grantees.value.filter((g) => g.kind === 'email' && g.isNew && g.notify).map((g) => g.value)),
  ];
  if (toNotify.length > 0) {
    try {
      const fn = await useFunctionAsync('notifyDocumentAccess');
      await fn({ docId: props.docId, emails: toNotify });
    } catch (e) {
      Loading.hide();
      notifyError('權限已更新，但寄送通知失敗', e);
      dialogModel.value = false;
      return;
    }
  }
  Loading.hide();
  notifySuccess('已更新協作者');
  dialogModel.value = false;
}

async function transferOwnership() {
  const newOwner = transferEmail.value.trim().toLowerCase();
  if (!newOwner) return;
  const oldOwner = props.doc.authorEmail;
  // Keep the previous owner as a manager so they don't lose access.
  const managers = new Set(grantees.value.filter((g) => g.kind === 'email' && g.tier === 'manager').map((g) => g.value));
  if (oldOwner && oldOwner !== 'legacy') managers.add(oldOwner.toLowerCase());
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
