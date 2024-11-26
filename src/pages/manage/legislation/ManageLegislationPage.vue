<template>
  <q-btn color="positive" icon="add" label="新增法案" @click="add" class="q-ma-md" />
  <LegislationPage manage />
  <LegislationDialog v-model="target" :action="action" @submit="submit" />
</template>

<script lang="ts" setup>
import LegislationPage from 'pages/legislation/view/LegislationPage.vue';
import { reactive, ref } from 'vue';
import {
  Addendum,
  History,
  Legislation,
  LegislationCategory,
  LegislationContent,
  legislationDocument,
  LegislationType,
  useLegislations
} from 'src/ts/models.ts';
import { date, Loading, Notify } from 'quasar';
import LegislationDialog from 'components/LegislationDialog.vue';
import { useRouter } from 'vue-router';
import { setDoc } from 'firebase/firestore';

const action = ref<'add' | null>(null);
const target = reactive({} as { name: string; category: LegislationCategory; type: LegislationType; createdAt: string; preface?: string });
const router = useRouter();
const legislations = useLegislations();

function add() {
  target.name = '';
  target.category = LegislationCategory.StudentCouncil;
  target.type = LegislationType.Law;
  target.createdAt = date.formatDate(new Date(), 'YYYY-MM-DD');
  action.value = 'add';
}

async function submit() {
  Loading.show();
  try {
    let last = 0;
    for (const legislation of legislations.value) {
      console.log(legislation)
      if (legislation && (legislation as any).id.startsWith(target.category.idPrefix)) {
        try {
          const num = parseInt((legislation as any).id.slice(target.category.idPrefix.length)); // If the prefix doesn't fully match, this will throw
          last = Math.max(last, num);
        } catch (e) {}
      }
    }
    target.createdAt = date.extractDate(target.createdAt, 'YYYY-MM-DD') as any;
    const id = target.category.idPrefix + (last + 1).toString().padStart(3, '0');
    await setDoc(legislationDocument(id), {
      ...target,
      history: [] as History[],
      content: [] as LegislationContent[],
      addendum: [] as Addendum[],
      attachments: [] as string[],
    } as unknown as Legislation);
    action.value = null;
    Notify.create({ type: 'positive', message: '新增法案成功' });
    await router.push(`/manage/legislation/${id}`);
  } catch (e) {
    console.error(e);
    Notify.create({ type: 'negative', message: '新增法案失敗' });
    return;
  } finally {
    Loading.hide();
  }
}
</script>

<style scoped></style>
