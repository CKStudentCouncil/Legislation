<template>
  <div>
    <p class="text-h6 text-bold">附件{{ translateNumberToChinese(props.order) }}</p>
    <p>{{ props.attachment.description }}</p>
    <div v-for="url of props.attachment.urls" :key="url">
      <iframe
        v-if="!noEmbed && getGoogleFileEmbed(url)"
        :src="getGoogleFileEmbed(url)"
        allow="autoplay"
        class="no-print"
        height="600"
        width="100%"
        title="Google 雲端附件預覽"
      ></iframe>
      <div v-else>
        <a v-if="isUrl(url)" :href="url" target="_blank" style="word-wrap: break-word">{{ url }}</a>
        <p v-else>{{ url }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Attachment } from 'src/ts/models.ts';
import { translateNumberToChinese } from '../ts/utils.ts';
import { isUrl } from 'src/ts/checks.ts';

const props = defineProps<{
  attachment: Attachment;
  order: number;
  noEmbed?: boolean;
}>();

// Linear-time equivalent of `input.match(/<one of prefixes>(.*)<suffix>.*/)?.at(-1)`. That regex form backtracks polynomially on a long stored URL
// that repeats the prefix without ever containing the suffix, so the same result is computed without a regex. `.` never crosses a line terminator,
// so a match lies within one line: the first line holding the suffix after a prefix wins, at that line's leftmost prefix, and the greedy `(.*)`
// runs to the last suffix on the line. Returns undefined when there is no match (an empty capture is a match and returns '').
function captureBeforeLastSuffix(input: string, prefixes: string[], suffix: string) {
  for (const line of input.split(/[\n\r\u2028\u2029]/)) {
    const end = line.lastIndexOf(suffix);
    if (end < 0) continue;
    const head = line.slice(0, end);
    let first = -1;
    let firstLength = 0;
    for (const prefix of prefixes) {
      const found = head.indexOf(prefix);
      if (found >= 0 && (first < 0 || found < first)) {
        first = found;
        firstLength = prefix.length;
      }
    }
    if (first >= 0) return head.slice(first + firstLength);
  }
  return undefined;
}

function getGoogleFileEmbed(input: string) {
  let file_id = null;
  const driveCapture = captureBeforeLastSuffix(input, ['https://drive.google.com/file/d/'], '/view');
  if (driveCapture !== undefined) {
    file_id = driveCapture;
  }
  const documentPrefixes = ['document', 'spreadsheets', 'presentation'].map((kind) => `https://docs.google.com/${kind}/d/`);
  const documentCapture = captureBeforeLastSuffix(input, documentPrefixes, '/edit');
  if (documentCapture !== undefined) {
    file_id = documentCapture;
  }
  if (file_id) {
    return `https://drive.google.com/file/d/${file_id}/preview`;
  }
}
</script>

<style scoped></style>
