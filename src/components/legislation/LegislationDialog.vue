<template>
  <q-dialog :model-value="action != null" persistent>
    <q-card>
      <q-card-section>
        <h6 class="q-ma-none">{{ action == 'edit' ? '編輯' : '新建' }}法令</h6>
      </q-card-section>
      <q-card-section>
        <q-input v-model="parentValue.name" label="法令名稱" />
        <q-input v-model="parentValue.preface" label="序言" />
        <q-select
          v-model="parentValue.category"
          :option-label="(o) => o.translation"
          :options="Object.values(LegislationCategory.VALUES)"
          label="法令類別"
        />
        <div class="q-pt-md q-pb-sm">立法日期：</div>
        <q-date v-model="parentValue.createdAt" mask="YYYY-MM-DD" />
        <br />
        <q-checkbox
          :model-value="!!parentValue.frozenBy"
          label="凍結或失效"
          @update:model-value="(v) => (v ? (parentValue.frozenBy = ' ') : (parentValue.frozenBy = undefined))"
        />
        <q-input v-if="parentValue.frozenBy" ref="frozenByRef" v-model="parentValue.frozenBy" :rules="[isUrl]" label="凍結或失效之依據公文" />
        <q-checkbox v-model="hasResolutionUrls" label="相關決議文" />
        <div v-if="parentValue.resolutionUrls">
          <q-list bordered>
            <q-item v-for="(r, i) in parentValue.resolutionUrls" :key="i">
              <q-item-section>{{ r.title }}</q-item-section>
              <q-item-section side>
                <div>
                  <q-btn flat dense icon="edit" size="10px" @click="editResolution(i)" />
                  <q-btn flat dense icon="delete" size="10px" color="negative" @click="removeResolution(i)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <q-btn flat dense icon="add" label="新增決議文" color="positive" @click="addResolution" />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="negative" flat label="取消" @click="$emit('canceled')" />
        <q-btn color="positive" flat label="確定" @click="$emit('submit')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import type { ResolutionUrl } from 'src/ts/models.ts';
import { LegislationCategory } from 'src/ts/models.ts';
import { computed, ref } from 'vue';
import { Dialog } from 'quasar';
import { isUrl } from 'src/ts/checks.ts';

const props = defineProps<{
  action: 'edit' | 'add' | null;
  modelValue: {
    name: string;
    category: LegislationCategory;
    createdAt: string;
    preface?: string;
    frozenBy?: string;
    resolutionUrls?: ResolutionUrl[];
  };
}>();
const emits = defineEmits({
  submit: null,
  canceled: null,
  'update:modelValue': null,
});
const frozenByRef = ref();

const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emits('update:modelValue', val);
  },
});

const hasResolutionUrls = computed({
  get() {
    return !!parentValue.value.resolutionUrls;
  },
  set(v: boolean) {
    parentValue.value.resolutionUrls = v ? [] : undefined;
  },
});

function validate() {
  return frozenByRef.value.validate();
}

function addResolution() {
  Dialog.create({
    title: '新增決議文',
    prompt: { model: '', label: '標題' },
    persistent: true,
    ok: true,
    cancel: true,
  }).onOk((title: string) => {
    Dialog.create({
      title: '新增決議文',
      prompt: { model: '', label: '連結' },
      persistent: true,
      ok: true,
      cancel: true,
    }).onOk((url: string) => {
      parentValue.value.resolutionUrls = [...(parentValue.value.resolutionUrls ?? []), { title, url }];
    });
  });
}

function editResolution(index: number) {
  const current = parentValue.value.resolutionUrls![index]!;
  Dialog.create({
    title: '編輯決議文',
    prompt: { model: current.title, label: '標題' },
    persistent: true,
    ok: true,
    cancel: true,
  }).onOk((title: string) => {
    Dialog.create({
      title: '編輯決議文',
      prompt: { model: current.url, label: '連結' },
      persistent: true,
      ok: true,
      cancel: true,
    }).onOk((url: string) => {
      const updated = [...parentValue.value.resolutionUrls!];
      updated[index] = { title, url };
      parentValue.value.resolutionUrls = updated;
    });
  });
}

function removeResolution(index: number) {
  parentValue.value.resolutionUrls = parentValue.value.resolutionUrls!.filter((_: ResolutionUrl, i: number) => i !== index);
}

defineExpose({ validate });
</script>

<style scoped></style>
