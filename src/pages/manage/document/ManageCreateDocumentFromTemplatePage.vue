<template>Loading...</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { Dialog, Loading } from 'quasar';
import { create, getEmptyDocument } from 'pages/manage/document/common.ts';
import { DocumentConfidentiality, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';
import { notifyError } from 'src/ts/utils.ts';
import { explainWriteError } from 'src/ts/firebase-errors.ts';

// The only keys a template may set: the document's content and classification. Everything else is ignored, notably the owner (authorEmail),
// the viewer/editor/manager grants (viewers, viewerEmails, editor*, manager*), the published state and the ID (idNumber). firestore.rules keeps
// the owner and the grants for the document's owner/managers, and create() writes whatever it is handed with setDoc, so a hostile template could
// otherwise take over the new document, publish it, or overwrite an existing document by naming its ID. An allow-list also drops unknown keys
// and '__proto__' (which would re-parent `adding` and let an inherited idNumber slip past the filter).
const TEMPLATE_KEYS = new Set<string>([
  'reign',
  'subject',
  'location',
  'fromSpecific',
  'fromName',
  'secretarySpecific',
  'secretaryName',
  'toSpecific',
  'toOther',
  'ccSpecific',
  'ccOther',
  'type',
  'content',
  'attachments',
  'confidentiality',
  'declassifyAt',
  'meetingTime',
  'prosecutionId',
  'plaintiff',
  'Defendant',
  'AbsentMeeting1',
  'AbsentMeeting2',
  'AbsentMeeting3',
]);

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
        notifyError('請先複製模板內容');
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
      if (!TEMPLATE_KEYS.has(key)) continue;
      let parsedValue: any;
      switch (key) {
        case 'fromSpecific':
        case 'secretarySpecific':
          parsedValue = DocumentSpecificIdentity.VALUES[value];
          break;
        case 'toSpecific':
        case 'ccSpecific':
          parsedValue = (value as unknown as string[]).map((v) => DocumentSpecificIdentity.VALUES[v]);
          break;
        case 'type':
          parsedValue = DocumentType.VALUES[value];
          break;
        case 'meetingTime':
        case 'declassifyAt':
          parsedValue = new Date(value as any);
          break;
        case 'confidentiality':
          parsedValue = DocumentConfidentiality.VALUES[value];
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
    // An account without a council role is refused by firestore.rules, correctly (LEGISLATION-7).
    const { message, report } = explainWriteError(e, '起草公文失敗');
    notifyError(message, e, { report });
    return;
  } finally {
    Loading.hide();
  }
}
</script>

<style scoped></style>
