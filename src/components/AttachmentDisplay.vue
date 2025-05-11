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
        <a
          v-if="isUrl(url)"
          :href="url"
          target="_blank"
          style="word-wrap: break-word;"
          >{{ url }}</a>
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

function getGoogleFileEmbed(input: string) {
  let file_id = null;
  const driveCapture = input.match(/https:\/\/drive\.google\.com\/file\/d\/(.*)\/view.*/);
  if (driveCapture && driveCapture.length > 1) {
    file_id = driveCapture[1];
  }
  const documentCapture = input.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/(.*)\/edit.*/);
  if (documentCapture && documentCapture.length > 2) {
    file_id = documentCapture[2];
  }
  if (file_id) {
    return `https://drive.google.com/file/d/${file_id}/preview`;
  }
}
</script>

<style scoped></style>
