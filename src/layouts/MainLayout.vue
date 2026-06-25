<template>
  <q-no-ssr>
    <q-layout view="hHh LpR fFf">
      <HeaderSidebar />
      <q-page-container>
        <router-view />
      </q-page-container>
    </q-layout>
  </q-no-ssr>
</template>

<script lang="ts" setup>
import HeaderSidebar from 'layouts/HeaderSidebar.vue';
import { useMeta } from 'quasar';

// Management, editor and amendment-tool routes use this layout. Keep them out of the
// search index (defense-in-depth alongside the robots.txt Disallow: /manage).
useMeta({ meta: { robots: { name: 'robots', content: 'noindex, follow' } } });
</script>
