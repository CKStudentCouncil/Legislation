<template>
  <div class="q-gutter-md row items-start">
    <q-file
      v-model="files"
      :error="error"
      :max-file-size="MAX_FILE_BYTES"
      error-message="請按下上傳按鈕再繼續！"
      filled
      label="選擇檔案 (或拖至此，可多選)"
      multiple
      style="max-width: 300px"
      @rejected="sizeLimitExceeded"
      @input="check"
    >
      <template v-slot:prepend>
        <q-icon :name="matAttachFile" />
      </template>
    </q-file>
    <q-btn class="row" color="primary" dense no-caps @click="upload">
      <div>
        <q-icon :name="matCloudUpload" />
        <br />上傳並加入附件
      </div>
    </q-btn>
  </div>
</template>

<script lang="ts" setup>
import { matAttachFile, matCloudUpload } from '@quasar/extras/material-icons';
import { ref } from 'vue';
import { useFunctionAsync } from 'boot/vuefire.ts';
import { Loading } from 'quasar';
import { notifyError, notifySuccess } from 'src/ts/utils.ts';
import { explainFunctionError } from 'src/ts/firebase-errors.ts';

// The file travels as a base64 string inside the callable's JSON body, a third larger than the
// file itself, and Cloud Run refuses any request over 32 MiB at its front door — with a 413 that
// carries no CORS headers, so the browser surfaces it as a failed fetch and the Functions SDK as
// a baffling `internal [0]` (LEGISLATION-J). 24 MiB of file is already exactly 32 MiB once
// encoded, so the old 25 MB promise could never be kept; 20 MiB leaves room for the JSON around
// it. (uploadAttachment's own 25 MiB check stays as a backstop for callers other than this form.)
const MAX_FILE_BYTES = 20 * 1024 * 1024;
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

function upload() {
  const results = [] as string[];
  let completed = 0;
  Loading.show();
  for (const file of files.value) {
    const name = `${props.filenamePrefix}${file.name}`;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const uploadAttachmentFn = await useFunctionAsync('uploadAttachment');
        const url = (
          (
            await uploadAttachmentFn({
              name,
              mimetype: file.type,
              content: (reader.result as string).split('base64,')[1],
            })
          ).data as any
        ).url;
        results.push(url);
        notifySuccess('上傳成功');
      } catch (e) {
        const { message, report } = explainFunctionError(e, '上傳失敗');
        notifyError(message, e, { report });
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
      emits('uploaded', results);
    }
  }, 100);
}

function check() {
  const r = files.value.length !== 0;
  error.value = r;
  return !r;
}

function sizeLimitExceeded() {
  notifyError('單一檔案不得超過20MB，請嘗試壓縮檔案後再繼續');
}

defineExpose({
  check,
});
</script>

<style scoped></style>
