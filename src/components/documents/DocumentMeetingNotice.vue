<template>
  <div v-if="!doc">載入中...(或查無此公文)</div>
  <div v-else>
    <div class="text-h4 q-mt-none flex-center text-center" style="font-size: 32px">臺北市立建國中學班聯會 {{ title }} 開會通知單</div>
    <div class="text-right">{{ doc.getFullId() }}</div>
    <div class="text-h6">
      <div>發文日期：{{ doc.publishedAt ? doc.publishedAt.toLocaleDateString() : '尚未發布' }}</div>
      <div>
        密等：{{ doc.confidentiality.translation }}<span v-if="readableViewers"> (限 {{ readableViewers }} 閱覽)</span
        ><span v-if="doc.declassifyAt"> (解密時間：{{ doc.declassifyAt.toLocaleString() }})</span>
      </div>
      <DocumentSeparator />
      <div>出席人：{{ readableTo }}</div>
      <div v-if="doc.ccSpecific.length > 0">列席人：{{ readableCC }}</div>
      <div>會議名稱：{{ doc.subject }}</div>
      <div v-if="doc.meetingTime">會議時間：{{ doc.meetingTime.toLocaleString() }}</div>
      <div v-if="doc.location">會議地點：{{ doc.location }}</div>
      <div v-if="doc.fromName">
        會議主席：{{ doc.fromSpecific.signatureTitle ?? doc.fromSpecific.translation }}
        {{ doc.fromName }}
      </div>
    </div>
    <DocumentSeparator />
    <SafeHtml :content="doc.content" />
    <DocumentSeparator />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as models from 'src/ts/models.ts';
import { DocumentGeneralIdentity, DocumentSpecificIdentity } from 'src/ts/models.ts';
import { getReadableRecipient } from 'src/ts/utils.ts';
import SafeHtml from 'components/SafeHtml.vue';
import DocumentSeparator from 'components/DocumentSeparator.vue';

const props = defineProps<{
  doc: models.Document;
}>();
const readableTo = computed(() => {
  return getReadableRecipient(props.doc.toSpecific, props.doc.toOther);
});
const readableCC = computed(() => {
  return getReadableRecipient(props.doc.ccSpecific, props.doc.ccOther);
});
const readableViewers = computed(() => {
  if (props.doc.confidentiality.firebase !== 'Confidential' || !props.doc.viewers || props.doc.viewers.length === 0) return '';
  return props.doc.viewers.map((v) => v.translation).join('、');
});
// Same result as subject.replace(/第.*次/, ''), in linear time: that regex is unanchored, so on a long run of 第 with no 次 it
// backtracks quadratically (and `subject` is stored, user-supplied text rendered on the public SSR path). It removes everything from
// the first 第 through the last 次 of the first line (`.` stops at \n, \r, \u2028 and \u2029) that has a 次 after a 第.
const stripSessionNumber = (s: string) => {
  let first = -1; // index of the first 第 on the current line
  let last = -1; // index of the last 次 after it on the current line
  for (let i = 0; i <= s.length; i++) {
    const c = i < s.length ? s.charAt(i) : '\n';
    if (c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029') {
      if (last >= 0) return s.slice(0, first) + s.slice(last + 1);
      first = -1;
      last = -1;
    } else if (c === '第') {
      if (first < 0) first = i;
    } else if (c === '次' && first >= 0) {
      last = i;
    }
  }
  return s;
};
const title = computed(() => {
  if (
    props.doc.fromSpecific.firebase == DocumentSpecificIdentity.Chairman.firebase ||
    props.doc.fromSpecific.firebase == DocumentSpecificIdentity.ViceChairman.firebase
  ) {
    // 跨部門會議
    return stripSessionNumber(props.doc.subject);
  }
  if (props.doc.fromSpecific.generic.firebase == DocumentGeneralIdentity.ExecutiveDepartment.firebase) {
    return props.doc.fromSpecific.translation;
  } else {
    return props.doc.fromSpecific.generic.translation;
  }
});
</script>

<style scoped></style>
