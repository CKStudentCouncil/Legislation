<template>Loading...</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { Dialog, Loading, Notify } from 'quasar';
import { create, getEmptyDocument } from 'pages/manage/document/common.ts';
import { DocumentConfidentiality, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';

const router = useRouter();
Dialog.create({
  title: '自動起草公文',
  message: '是否從模板自動起草公文？請只使用受信賴的模板(例：議事系統的自動生成議事錄功能)。也請確保已經登入！',
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
      const content = await navigator.clipboard.readText();
      if (content.startsWith('{')) {
        await proceed(JSON.parse(content));
      } else {
        Notify.create({ type: 'negative', message: '請先複製模板！' });
      }
    } catch (e) {
      Dialog.create({
        title: '自動起草公文',
        message: '無法讀取剪貼簿內容，請手動貼上。',
        cancel: true,
        persistent: true,
      }).onOk(async (c) => {
        await proceed(c);
      });
    }
  })
  .onCancel(async () => {
    await router.push('/manage/document/');
  });

async function proceed(content: string) {
  try {
    Loading.show();
    const adding = getEmptyDocument();
    for (const [key, value] of Object.entries(content)) {
      let parsedValue: any;
      switch (key) {
        case 'fromSpecific':
        case 'secretarySpecific':
          parsedValue = DocumentSpecificIdentity.VALUES[value as string];
          break;
        case 'toSpecific':
        case 'ccSpecific':
          parsedValue = (value as unknown as string[]).map((v) => DocumentSpecificIdentity.VALUES[v]);
          break;
        case 'type':
          parsedValue = DocumentType.VALUES[value as string];
          break;
        case 'createdAt':
        case 'publishedAt':
          parsedValue = new Date(value as any);
          break;
        case 'confidentiality':
          parsedValue = DocumentConfidentiality.VALUES[value as string];
          break;
        default:
          parsedValue = value;
          break;
      }
      // @ts-expect-error I know what I'm doing
      adding[key] = parsedValue;
    }
    const id = await create(adding, false);
    await router.push(`/manage/document/${id}`);
  } catch (e) {
    console.error(e);
    Notify.create({ type: 'negative', message: '起草公文失敗' });
    return;
  } finally {
    Loading.hide();
  }
}
</script>

<style scoped></style>
