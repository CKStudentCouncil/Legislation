<template>Loading...</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { Dialog, Loading, Notify } from 'quasar';
import { create, getEmptyDocument } from 'pages/manage/document/common.ts';
import { DocumentConfidentiality, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';

const route = useRoute();
const router = useRouter();
const adding = getEmptyDocument();
const arraySep = ';;;;;';
for (const [key, value] of Object.entries(route.query)) {
  if (key in adding) {
    let parsedValue: any;
    switch (key) {
      case 'fromSpecific':
      case 'secretarySpecific':
        parsedValue = DocumentSpecificIdentity.VALUES[value as string];
        break
      case 'toSpecific':
      case 'ccSpecific':
        parsedValue = (value as string).split(arraySep).map((v) => DocumentSpecificIdentity.VALUES[v]);
        break
      case 'toOther':
        parsedValue = (value as string).split(arraySep);
        break
      case 'type':
        parsedValue = DocumentType.VALUES[value as string];
        break
      case 'createdAt':
      case 'publishedAt':
        parsedValue = new Date(parseInt(value as string));
        break
      case 'attachments':
        parsedValue = JSON.parse(btoa(value as string));
        break
      case 'confidentiality':
        parsedValue = DocumentConfidentiality.VALUES[value as string];
        break
      default:
        parsedValue = value;
    }
    // @ts-expect-error I know what I'm doing
    adding[key] = parsedValue;
  }
}
Dialog.create({
  title: '自動起草公文',
  message: '是否從模板自動起草公文？請只使用受信賴的模板(即：議事系統的自動生成議事錄功能)。也請確保已經登入！',
  persistent: true,
  seamless: true,
  ok: {
    label: '確定',
    color: 'positive',
  },
  cancel: {
    label: '取消',
    flat: true,
    color: 'negative',
  },
})
  .onOk(async () => {
    try {
      Loading.show();
      const id = await create(adding);
      await router.push(`/manage/document/${id}`);
    } catch (e) {
      console.error(e);
      Notify.create({ type: 'negative', message: '起草公文失敗' });
      return;
    } finally {
      Loading.hide();
    }
  })
  .onCancel(async () => {
    await router.push('/manage/document/');
  });
</script>

<style scoped></style>
