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
</script>
