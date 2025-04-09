<template>
  <q-page class="row items-center justify-evenly" padding>
    <div v-if="!legislation">查無此法 (或載入中)</div>
    <div v-if="legislation" ref="content" class="official-font-when-printing" style="max-width: min(1170px, 97vw)">
      <div class="text-h4 flex-center q-pb-md text-center">
        {{ legislation.name }}
        <q-btn class="no-print" dense flat icon="link" size="20px" @click="copyLink()" />
      </div>
      <div v-if="legislation.preface" class="text-h6 text-bold">{{ legislation.preface }}</div>
      <div v-if="legislation.history.length > 0">
        立法沿革
        <div v-for="history of legislation.history" :key="history.amendedAt.valueOf()">
          {{ history.amendedAt.toLocaleDateString() + ' ' + history.brief }}
          <q-btn v-if="history.link" dense flat icon="open_in_new" size="10px" :to="history.link">
            <q-tooltip>檢視發布公文</q-tooltip>
          </q-btn>
        </div>
      </div>
      <LegislationContent
        v-for="content of legislation.content"
        :id="content.index.toString()"
        :key="content.title"
        :content="content"
        :class="content.index.toString() === route.hash.substring(1) ? (Dark.isActive ? 'bg-teal-10' : 'bg-yellow-3') : ''"
      />
      <LegislationAddendum v-for="addendum of legislation.addendum" :key="addendum.createdAt.valueOf()" :addendum="addendum" />
      <AttachmentDisplay
        v-for="(attachment, index) of legislation.attachments"
        :key="attachment.description + attachment.urls.toString()"
        :attachment="attachment"
        :order="index + 1"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useLegislation } from 'src/ts/models.ts';
import { useRoute } from 'vue-router';
import { copyLink } from 'src/ts/utils.ts';
import { Dark } from 'quasar';
import LegislationAddendum from 'components/LegislationAddendum.vue';
import LegislationContent from 'components/LegislationContent.vue';
import AttachmentDisplay from 'components/AttachmentDisplay.vue';

const route = useRoute();
const legislation = useLegislation(route.params.id as string);
</script>

<style scoped>

</style>
