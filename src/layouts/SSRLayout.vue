<template>
  <q-layout view="hHh LpR fFf">
    <HeaderSidebar />
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import HeaderSidebar from 'layouts/HeaderSidebar.vue';
</script>
