<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!legislation">查無此法 (或載入中)</div>
    <div v-if="legislation" ref="content" class="official-font-when-printing" style="max-width: 1170px">
      <div class="text-h4 flex-center q-pb-md text-center">
        {{ legislation.name }}
        <q-btn class="no-print" dense flat icon="link" size="20px" @click="copyLink()" />
        <q-btn class="no-print" dense flat icon="print" size="20px" @click="handlePrint">
          <q-tooltip>列印</q-tooltip>
        </q-btn>
        <q-btn class="no-print" dense flat icon="unfold_less" v-if="Object.entries(expanded).length > 0" size="20px" @click="collapseAll">
          <q-tooltip>折疊所有條文</q-tooltip>
        </q-btn>
        <q-btn class="no-print" dense flat icon="unfold_more" v-if="Object.entries(expanded).length > 0" size="20px" @click="expandAll">
          <q-tooltip>展開所有條文</q-tooltip>
        </q-btn>
      </div>
      <div v-if="legislation.preface" class="text-h6 text-bold">{{ legislation.preface }}</div>
      <div v-if="legislation.history.length > 0">
        立法沿革
        <div v-for="history of legislation.history" :key="history.amendedAt.valueOf()">
          {{ history.amendedAt.toLocaleDateString() + ' ' + history.brief }}
          <q-btn v-if="history.link" dense flat icon="open_in_new" size="10px" :href="history.link">
            <q-tooltip>檢視發布公文</q-tooltip>
          </q-btn>
        </div>
      </div>
      <LegislationContent
        v-for="content of legislation.content"
        :id="content.index.toString()"
        :key="content.title"
        :content="content"
        :printing="printing"
        :expanded="expanded[content.index]"
        @update:expanded="expanded[content.index] = $event"
        :class="content.index.toString() === route.hash.substring(1) ? (Dark.isActive ? 'bg-teal-10' : 'bg-yellow-3') : ''"
      />
      <LegislationAddendum v-for="addendum of legislation.addendum" :key="addendum.createdAt.valueOf()" :addendum="addendum" />
      <AttachmentDisplay
        v-for="(attachment, index) of legislation.attachments"
        :key="attachment.description + attachment.urls.toString()"
        :attachment="attachment"
        :no-embed="printing"
        :order="index + 1"
      />
    </div>
  </q-page>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router';
import { ContentType, useLegislation } from 'src/ts/models.ts';
import { reactive, ref, watch } from 'vue';
import { event } from 'vue-gtag';
import LegislationContent from 'components/LegislationContent.vue';
import { copyLink } from 'src/ts/utils.ts';
import LegislationAddendum from 'components/LegislationAddendum.vue';
import { useVueToPrint } from 'vue-to-print';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';
import { Dark } from 'quasar';

const route = useRoute();
const legislation = useLegislation(route.params.id! as string);
const content = ref();
const printing = ref(false);
const expanded = reactive({} as Record<number, boolean>);

watch(legislation, () => {
  event('view_legislation', {
    id: route.params.id! as string,
    name: legislation.value?.name,
    category: legislation.value?.category.translation,
    type: legislation.value?.category.type.translation,
  });
  document.title = legislation.value?.name + ' - 建中班聯會法律資料庫';
  for (const content of legislation.value?.content ?? []) {
    if (content.type.firebase === ContentType.SpecialClause.firebase) {
      expanded[content.index] = true;
    }
  }
  if (route.hash) {
    // wait for the content to load
    setTimeout(() => {
      const el = document.getElementById(route.hash.substring(1));
      if (el) {
        window.scrollTo({
          top: el.offsetTop - 100,
          behavior: 'smooth',
        });
      }
    }, 250);
  }
});

const { handlePrint } = useVueToPrint({
  content: content,
  documentTitle: legislation.value?.name ?? '',
  removeAfterPrint: true,
  pageStyle: '@page { margin: 0.5in 0.5in 0.5in 0.5in !important; }',
  onBeforeGetContent: () => {
    return new Promise((resolve) => {
      printing.value = true;
      setTimeout(() => {
        resolve();
      }, 300);
    });
  },
  onAfterPrint: () => {
    setTimeout(() => {
      printing.value = false;
    }, 300);
  },
});

function collapseAll() {
  for (const key in expanded) {
    expanded[key] = false;
  }
}

function expandAll() {
  for (const key in expanded) {
    expanded[key] = true;
  }
}
</script>

<style scoped></style>
