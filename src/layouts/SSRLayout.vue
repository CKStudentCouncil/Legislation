<template>
  <q-layout view="hHh LpR fFf">
    <!-- Server-rendered primary navigation. The visible header/drawer (HeaderSidebar) is
         wrapped in q-no-ssr, so without this crawlers and answer engines would receive
         no internal links at all. Visually hidden; the interactive chrome is client-side. -->
    <nav class="sr-only" aria-label="主要導覽">
      <router-link to="/">首頁</router-link>
      <router-link to="/legislation">檢視法令</router-link>
      <router-link to="/document">檢視公文</router-link>
      <router-link to="/document/judicial">評委文書</router-link>
      <router-link to="/about">關於與使用條款</router-link>
    </nav>
    <HeaderSidebar />
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import HeaderSidebar from 'layouts/HeaderSidebar.vue';
</script>
