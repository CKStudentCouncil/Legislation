<template>
  <q-page padding>
    <q-select v-model="reign" :options="reigns" label="屆次" />
    <q-tree v-model="expanded" :nodes="tree" node-key="label">
      <template v-slot:default-header="prop">
        <div v-if="!prop.node.link">{{ prop.node.label }}</div>
        <q-btn v-else flat :to="prop.node.link">{{ prop.node.label }}</q-btn>
      </template>
    </q-tree>
  </q-page>
</template>

<script lang="ts" setup>
import { DocumentGeneralIdentity, DocumentSpecificIdentity, DocumentType, usePublicDocuments } from 'src/ts/models.ts';
import { computed, reactive, ref, watch } from 'vue';
import { getCurrentReign } from 'src/ts/utils.ts';

const documents = usePublicDocuments();
const tree = ref([]);
const expanded = reactive([] as string[]);
const reign = ref(getCurrentReign());
const reigns = computed(() => {
  return documents.value
    .map((document) => document?.reign)
    .filter(function (item, pos, self) {
      return self.indexOf(item) == pos; // deduplicate
    });
});
const props = defineProps({
  manage: {
    type: Boolean,
    default: false,
  },
});

watch(
  documents,
  () => {
    const temp = [];
    for (const generic of Object.values(DocumentGeneralIdentity.VALUES)) {
      const docs1 = documents.value
        .filter((document) => document?.from.firebase == generic.firebase)
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
              label: document?.subject,
              id: (document as any).id,
              link: (props.manage ? '/manage/document/' : '/document/') + (document as any).id,
            })),
          });
        }
        children1.push({
          label: specific.translation,
          children: children2,
        });
      }
      temp.push({
        label: generic.translation,
        children: children1,
      });
      expanded.push(generic.translation);
    }
    tree.value = temp as any;
    console.log(expanded);
  },
  { deep: true },
);
</script>

<style scoped></style>
