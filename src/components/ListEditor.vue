<template>
  <q-btn class="q-mb-md" color="primary" label="新增項目" @click="addItem" />
  <q-list bordered>
    <VueDraggable v-model="parentValue" style="cursor: move">
      <q-item v-for="(item, index) in parentValue" :key="item" class="q-mb-sm">
        <q-item-section>
          {{ item }}
        </q-item-section>
        <q-item-section side>
          <q-btn color="primary" icon="edit" dense @click="editItem(index)" />
          <q-btn color="negative" icon="delete" dense @click="removeItem(index)" />
        </q-item-section>
      </q-item>
    </VueDraggable>
  </q-list>
</template>

<script lang="ts" setup>
import { Dialog, QBtn, QItem, QItemSection, QList } from 'quasar';
import { VueDraggable } from 'vue-draggable-plus';
import { computed } from 'vue';

const emit = defineEmits(['update:modelValue']);
const props = defineProps(['modelValue']);
const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  },
});

function addItem() {
  Dialog.create({
    title: '新增項目',
    prompt: {
      model: '',
      label: '內容',
    },
    persistent: true,
    ok: true,
    cancel: true,
  }).onOk((data) => {
    parentValue.value.push(data);
  });
}

function editItem(index: number) {
  Dialog.create({
    title: '編輯項目',
    prompt: {
      model: parentValue.value[index],
      label: '內容',
      type: 'textarea',
    },
    persistent: true,
    ok: true,
    cancel: true,
  }).onOk((data) => {
    parentValue.value[index] = data;
  });
}

function removeItem(index: number) {
  parentValue.value.splice(index, 1);
}
</script>

<style scoped></style>
