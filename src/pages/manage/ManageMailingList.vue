<template>
  <q-page>
    <q-tabs align="left">
      <q-route-tab label="帳戶" to="/manage/accounts" />
      <q-route-tab label="郵寄清單" to="/manage/accounts/mailing_list" />
    </q-tabs>
    <q-table
      v-if="mailingList"
      :columns="columns"
      :filter="filter"
      :loading="!mailingList"
      :rows="mailingList?.main"
      class="rounded-borders shadow-2 q-ma-md"
      color="primary"
      row-key="email"
      title="郵寄清單管理"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
          <q-btn icon="add_to_photos" @click="bulkAdd">批次新增帳號</q-btn>
          <q-btn icon="add" @click="add">新增帳號</q-btn>
          <q-input v-model="filter" debounce="300" dense label="搜尋">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </div>
      </template>
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            <div v-if="col.name !== 'roles'">{{ col.value }}</div>
            <div v-else>
              <q-chip v-for="role of col.value" :key="role" :label="role.translation" />
            </div>
          </q-td>
          <q-td key="actions" style="text-align: right">
            <q-btn class="text-yellow-9 q-ml-sm q-mr-sm" icon="edit" round @click="edit(props.row)">
              <q-tooltip>編輯</q-tooltip>
            </q-btn>
            <q-btn class="text-red q-ml-sm q-mr-sm" icon="delete" round @click="del(props.row)">
              <q-tooltip>刪除</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </q-page>
  <q-dialog v-model="dialog">
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">編輯帳號</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="target.email" :disable="action == 'edit'" :readonly="action == 'edit'" label="Email" />
        <RoleSelect v-model="target.roles" :firebase="false" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="action = ''" />
        <q-btn color="primary" flat label="儲存" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="bulkAction">
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">批次新增帳號</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="bulkEmail" label="Email (每行一個)" type="textarea" />
        <RoleSelect v-model="bulkRole" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="bulkAction = false" />
        <q-btn color="primary" flat label="儲存" @click="bulkSubmit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { convertMailingListEntryToFirebase, DocumentSpecificIdentity, mailingListDoc, useMailingList } from 'src/ts/models.ts';
import { Dialog, Loading, QTableColumn } from 'quasar';
import { computed, reactive, ref } from 'vue';
import RoleSelect from 'components/RoleSelect.vue';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { arrayRemove, arrayUnion, updateDoc } from 'firebase/firestore';

const columns = [
  { name: 'email', label: 'Email', field: 'email', sortable: true, align: 'left' },
  { name: 'roles', label: '身分', field: 'roles', sortable: true, align: 'left' },
] as QTableColumn[];
const mailingList = useMailingList();
const filter = ref('');
const action = ref('' as 'edit' | 'add' | '');
const bulkAction = ref(false);
const dialog = computed(() => {
  return action.value === 'edit' || action.value === 'add';
});
const target = reactive({
  email: '',
  roles: [] as DocumentSpecificIdentity[],
  index: 0,
});
const bulkEmail = ref('');
const bulkRole = ref<string[]>([]);

function add() {
  action.value = 'add';
  target.email = '';
  target.roles = [];
}

function bulkAdd() {
  bulkEmail.value = '';
  bulkRole.value = [];
  bulkAction.value = true;
}

function edit(row: any) {
  action.value = 'edit';
  target.email = row.email;
  target.roles = row.roles;
  target.index = mailingList.value!.main.findIndex((e) => e.email === row.email);
}

function del(row: any) {
  Dialog.create({
    title: '刪除郵寄標的',
    message: '確定要刪除此郵寄標的嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await updateDoc(mailingListDoc(), {
        main: arrayRemove(convertMailingListEntryToFirebase(row)),
      });
    } catch (e) {
      notifyError('刪除失敗', e);
      return;
    }
    Loading.hide();
    notifySuccess('成功刪除郵寄標的');
  });
}

async function submit() {
  Loading.show();
  try {
    if (action.value === 'edit') {
      mailingList.value!.main[target.index] = target;
      await updateDoc(mailingListDoc(), {
        main: mailingList.value!.main.map(convertMailingListEntryToFirebase),
      });
    } else if (action.value === 'add') {
      await updateDoc(mailingListDoc(), {
        main: arrayUnion(convertMailingListEntryToFirebase(target)),
      });
    }
  } catch (e) {
    notifyError('更新失敗', e);
    return;
  }
  Loading.hide();
  action.value = '';
  notifySuccess('帳號資料已更新');
}

async function bulkSubmit() {
  Loading.show();
  try {
    const emails = bulkEmail.value
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => !!e);
    const roles = bulkRole.value;
    await updateDoc(mailingListDoc(), {
      main: arrayUnion(
        ...emails.map((email) => {
          return { email, roles };
        }),
      ),
    });
  } catch (e) {
    notifyError('批次新增失敗', e);
    return;
  }
  Loading.hide();
  bulkAction.value = false;
  notifySuccess('成功批次新增帳號');
}
</script>

<style scoped></style>
