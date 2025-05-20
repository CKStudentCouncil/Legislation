<template>
<q-page padding class="row q-pr-none">
  <div class="col-2" style="min-width: 200px">
    <q-input v-model="reign" :label="`屆次 (例：${getCurrentReign()})`" clearable debounce="500" />
    <q-list bordered class="rounded-borders q-mt-md" padding>
      <q-item
        v-for="category of Object.values(DocumentType.VALUES).filter(c => c.icon)"
        :key="category.firebase"
        :active="selected == category.firebase"
        clickable
        @click="selected = selected == category.firebase ? '' : category.firebase"
      >
        <q-item-section avatar>
          <q-icon :name="category.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ category.translation }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
  <DocumentsPageV2 class="col-12 col-sm" :filters="false" :filter-type="selected" :dense="false"></DocumentsPageV2>
</q-page>
</template>

<script lang="ts" setup>
import { DocumentType } from 'src/ts/models.ts';
import { ref } from 'vue';
import DocumentsPageV2 from 'pages/documents/DocumentsPageV2.vue';
import { getCurrentReign } from 'src/ts/utils.ts';

const selected = ref(DocumentType.JudicialCommitteeExplanation.firebase);
const reign = ref(getCurrentReign());
</script>

<style scoped></style>
