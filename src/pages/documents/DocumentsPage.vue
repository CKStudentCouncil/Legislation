<template>
  <q-page padding>
    <q-select v-model="reign" :options="reigns" label="屆次" />
    <q-tree v-model:expanded="expanded" :nodes="tree" node-key="label">
      <template v-slot:default-header="prop">
        <div v-if="!prop.node.link">{{ prop.node.label }}</div>
        <q-btn v-else :to="prop.node.link" flat>{{ prop.node.label }}</q-btn>
      </template>
    </q-tree>
  </q-page>
</template>

<script lang="ts" setup>
import { DocumentGeneralIdentity, DocumentSpecificIdentity, DocumentType, useDocuments, usePublicDocuments } from 'src/ts/models.ts';
import { computed, ref, watch } from 'vue';
import { getCurrentReign } from 'src/ts/utils.ts';
import { Screen } from 'quasar';

const props = defineProps({
  manage: {
    type: Boolean,
    default: false,
  },
});
const documents = props.manage ? useDocuments() : usePublicDocuments();
const tree = ref([]);
const expanded = ref([] as string[]);
const reign = ref(getCurrentReign());
const reigns = computed(() => {
  return documents.value
    .map((document) => document?.reign)
    .filter(function (item, pos, self) {
      return self.indexOf(item) == pos; // deduplicate
    });
});

watch(
  documents,
  () => {
    load();
  },
  { deep: true },
);
watch(
  reign,
  () => {
    if (documents.value.length > 0) {
      load();
    }
  },
  { deep: true },
);

function load() {
  const temp = [];
  for (const generic of Object.values(DocumentGeneralIdentity.VALUES)) {
    const docs1 = documents.value
      .filter((document) => document?.fromSpecific.generic.firebase == generic.firebase)
      .filter((document) => document?.reign == reign.value);
    if (docs1.length == 0) {
      continue;
    }
    const children1 = [] as any[];
    for (const specific of Object.values(DocumentSpecificIdentity.VALUES)) {
      if (specific.generic !== generic) {
        continue;
      }
      const docs2 = docs1.filter((document) => document?.fromSpecific.firebase == specific.firebase);
      if (docs2.length == 0) {
        continue;
      }
      const children2 = [];
      for (const type of Object.values(DocumentType.VALUES)) {
        const docs3 = docs2.filter((document) => document?.type.firebase == type.firebase);
        if (docs3.length == 0) {
          continue;
        }
        children2.push({
          label: type.translation,
          children: docs3.map((document) => ({
            label: (Screen.width > 480 ? (document as any).id + ': ' : '') + document?.subject,
            id: (document as any).id,
            link: (props.manage ? '/manage/document/' : '/document/') + (document as any).id,
          })),
        });
        expanded.value.push(type.translation);
      }
      children1.push({
        label: specific.translation,
        children: children2,
      });
      expanded.value.push(specific.translation);
    }
    temp.push({
      label: generic.translation,
      children: children1,
    });
    expanded.value.push(generic.translation);
  }
  tree.value = temp as any;
}
</script>

<style scoped></style>
