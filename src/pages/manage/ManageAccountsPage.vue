<template>
  <q-page padding>
    <q-table
      :columns="columns"
      :filter="filter"
      :loading="loading"
      :rows="Object.values(accounts)"
      class="rounded-borders shadow-2"
      color="primary"
      row-key="email"
      title="帳號管理"
    >
      <template v-slot:top-right>
        <div class="row justify-end q-gutter-sm">
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
              <q-chip v-for="role of col.value" :key="role" :label="DocumentSpecificIdentity.VALUES[role]?.translation" />
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
        <q-input v-model="targetUser.name" :disable="action == 'edit'" :readonly="action == 'edit'" label="姓名" />
        <q-input v-model="targetUser.email" :disable="action == 'edit'" :readonly="action == 'edit'" label="Email" />
        <q-select
          v-model="targetUser.roles"
          :option-label="(o) => o.translation"
          :option-value="(o) => o.firebase"
          :options="Object.values(DocumentSpecificIdentity.VALUES)"
          emit-value
          label="身分"
          map-options
          multiple
          use-chips
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="action = ''" />
        <q-btn color="primary" flat label="儲存" @click="submit()" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue';
import { DocumentSpecificIdentity, User } from 'src/ts/models.ts';
import { getAllUsers } from '../../ts/auth.ts';
import { useFunction } from 'boot/vuefire.ts';
import { Dialog, Loading, QTableColumn } from 'quasar';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

const columns = [
  { name: 'name', label: '姓名', field: 'name', sortable: true, align: 'left' },
  { name: 'roles', label: '身分', field: 'roles', sortable: true, align: 'left' },
  { name: 'email', label: 'Email', field: 'email', sortable: true, align: 'left' },
] as QTableColumn[];
const loading = ref(true);
const action = ref('');
const targetUser = reactive({} as User);
const accounts = reactive([] as User[]);
const filter = ref('');
const dialog = computed(() => {
  return action.value === 'edit' || action.value === 'add';
});

async function load() {
  loading.value = true;
  accounts.length = 0; // Typescript magic
  for (const acc of (await getAllUsers()) as User[]) {
    accounts.push(acc);
  }
  loading.value = false;
}

function edit(row: any) {
  action.value = 'edit';
  targetUser.name = row.name;
  targetUser.email = row.email;
  targetUser.roles = row.roles;
  targetUser.uid = row.uid;
}

function add() {
  action.value = 'add';
  targetUser.name = '';
  targetUser.email = '';
  targetUser.roles = [];
  targetUser.uid = '';
}

async function submit() {
  Loading.show();
  try {
    if (action.value === 'edit') {
      await useFunction('editUser')({
        uid: targetUser.uid,
        claims: {
          roles: targetUser.roles,
        },
      });
    } else if (action.value === 'add') {
      await useFunction('addUser')(targetUser);
    }
  } catch (e) {
    notifyError('更新失敗', e);
    return;
  }
  Loading.hide();
  action.value = '';
  await load();
  notifySuccess('帳號資料已更新');
}

async function del(row: any) {
  Dialog.create({
    title: '刪除帳號',
    message: '確定要刪除此帳號嗎？',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    Loading.show();
    try {
      await useFunction('deleteUser')({ uid: row.uid });
    } catch (e) {
      notifyError('刪除失敗', e);
      return;
    }
    Loading.hide();
    await load();
    notifySuccess('成功刪除帳號');
  });
}

load();
</script>

<style scoped></style>
