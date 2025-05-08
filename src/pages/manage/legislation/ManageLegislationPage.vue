<template>
  <q-btn class="q-ma-md" color="positive" icon="add" label="新增法令" @click="add" />
  <LegislationPage manage />
  <LegislationDialog v-model="target" :action="action" @canceled="action = null" @submit="submit" />
</template>

<script lang="ts" setup>
import LegislationPage from 'pages/legislation/LegislationPage.vue';
import { reactive, ref } from 'vue';
import type { Addendum, History, Legislation, LegislationContent} from 'src/ts/models.ts';
import { LegislationCategory, legislationDocument, useLegislations } from 'src/ts/models.ts';
import { date, Loading } from 'quasar';
import LegislationDialog from 'components/LegislationDialog.vue';
import { useRouter } from 'vue-router';
import { setDoc } from 'firebase/firestore';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

const action = ref<'add' | null>(null);
const target = reactive({} as { name: string; category: LegislationCategory; createdAt: string; preface?: string });
const router = useRouter();
const legislations = useLegislations();

function add() {
  target.name = '';
  target.category = LegislationCategory.StudentCouncil;
  target.createdAt = date.formatDate(new Date(), 'YYYY-MM-DD');
  action.value = 'add';
}

async function submit() {
  Loading.show();
  try {
    let last = 0;
    for (const legislation of legislations.value) {
      if (legislation && (legislation as any).id.startsWith(target.category.idPrefix)) {
        try {
          const num = parseInt((legislation as any).id.slice(target.category.idPrefix.length)); // If the prefix doesn't fully match, this will throw
          if (!isNaN(num)) {
            last = Math.max(last, num);
          }
        } catch (e) { /* empty */ }
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
    notifySuccess('新增法令成功');
    await router.push(`/manage/legislation/${id}`);
  } catch (e) {
    notifyError('新增法令失敗', e);
    return;
  } finally {
    Loading.hide();
  }
}
</script>

<style scoped></style>
