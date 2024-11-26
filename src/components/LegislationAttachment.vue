<template>
  <div>
    <p class="text-h6 text-bold">附件{{ translateNumberToChinese(props.order) }}</p>
    <p>{{ props.attachment.description }}</p>
    <div v-for="url of props.attachment.urls" :key="url">
      <iframe v-if="getGoogleFileEmbed(url)" :src="getGoogleFileEmbed(url)" width="100%" height="600" allow="autoplay"></iframe>
      <a v-else :href="url" target="_blank">{{ url }}</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Attachment } from 'src/ts/models.ts';
import { translateNumberToChinese } from '../ts/utils.ts';

const props = defineProps<{
  attachment: Attachment;
  order: number;
}>();

function getGoogleFileEmbed(input: string) {
  let file_id = null;
  const driveCapture = input.match(/https:\/\/drive\.google\.com\/file\/d\/(.*)\/view.*/);
  if (driveCapture&&driveCapture.length>1) {
    file_id = driveCapture[1];
  }
  const documentCapture = input.match(/https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/(.*)\/edit.*/);
  if (documentCapture&&documentCapture.length>2) {
    file_id = documentCapture[2];
  }
  if (file_id) {
    return `https://drive.google.com/file/d/${file_id}/preview`;
  }
}
</script>

<style scoped>

</style>
