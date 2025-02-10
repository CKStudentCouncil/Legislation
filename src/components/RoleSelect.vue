<template>
  <q-select
    v-model="parentValue"
    :option-label="(o) => o.translation"
    :option-value="(o) => o.firebase"
    :options="Object.values(DocumentSpecificIdentity.VALUES)"
    :emit-value="firebase"
    label="身分"
    map-options
    multiple
    use-chips
  />
</template>

<script setup lang="ts">

import { DocumentSpecificIdentity } from 'src/ts/models.ts';
import { computed } from 'vue';

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  modelValue: {
    type: Array,
  },
  firebase: { // Whether to read & yield roles in .firebase format
    type: Boolean,
    default: true,
  },
});
const parentValue = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  },
});
</script>

<style scoped>

</style>
