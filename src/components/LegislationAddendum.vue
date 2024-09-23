<script lang="ts" setup>
import { translateNumberToChinese } from 'src/ts/utils.ts';

defineProps({
  addendum: {
    type: Object,
    required: true,
  },
  editable: {
    type: Boolean,
    default: false,
  },
});
defineEmits({
  remove: (addendum: any) => true,
  edit: (addendum: any) => true,
});
</script>

<template>
  <div class="row">
    <div class="col">
      <p class="text-h6 text-bold">
        {{ addendum.createdAt.toLocaleDateString() }} 通過附帶決議{{ translateNumberToChinese(addendum.content.length) }}項：
      </p>
      <p v-for="[index, content] of addendum.content.entries()" :key="content">
        <span class="q-mr-sm text-secondary text-italic">{{ index + 1 }}</span>
        {{ content }}
      </p>
    </div>
    <div v-if="editable" class="self-center">
      <q-btn flat icon="edit" size="10px" @click="$emit('edit', addendum)" />
      <q-btn color="negative" flat icon="delete" size="10px" @click="$emit('remove', addendum)" />
    </div>
  </div>
</template>

<style scoped></style>
