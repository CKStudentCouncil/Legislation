<template>
  <div class="q-gutter-md row items-start">
    <q-file v-model="files" filled label="選擇檔案 (或拖至此，可多選)" multiple style="max-width: 300px" :error="error" error-message="請按下上傳按鈕再繼續！" @input="check">
      <template v-slot:prepend>
        <q-icon name="attach_file" />
      </template>
    </q-file>
    <q-btn color="primary" dense label="上傳並加入附件" @click="upload" />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { useFunction } from 'boot/vuefire.ts';
import { Loading } from 'quasar';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';

const files = ref<File[]>([]);
const emits = defineEmits<{
  uploaded: [urls: string[]];
}>();
const props = defineProps({
  filenamePrefix: {
    type: String,
    required: false,
    default: '',
  },
});
const error = ref(false);

async function upload() {
  const results = [] as string[];
  let completed = 0;
  Loading.show();
  for (const file of files.value) {
    const name = `${props.filenamePrefix}${file.name}`;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const url = (
          (
            await useFunction('uploadAttachment')({
              name,
              mimetype: file.type,
              content: (reader.result as string).split('base64,')[1],
            })
          ).data as any
        ).url;
        results.push(url);
        notifySuccess('上傳成功');
      } catch (e) {
        notifyError('上傳失敗', e);
      }
      completed++;
    };
    reader.onabort = () => {
      console.log('file reading was aborted');
      completed++;
    };
    reader.onerror = () => {
      console.log('file reading has failed');
      completed++;
    };
  }
  const interval = setInterval(() => {
    if (completed === files.value.length) {
      Loading.hide();
      clearInterval(interval);
      files.value = [];
      error.value = false;
      emits('uploaded', results as string[]);
    }
  }, 100);
}

function check() {
  const r = (files.value.length !== 0);
  error.value = r;
  return !r;
}

defineExpose({
  check,
});
</script>

<style scoped></style>
