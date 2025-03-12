<template>
  <q-layout view="hHh LpR fFf">
    <q-header class="bg-primary text-white" elevated height-hint="98">
      <q-toolbar>
        <q-btn dense flat icon="menu" round @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img alt="favicon" src="/icon.png" />
          </q-avatar>
          <span class="q-pl-sm" v-if="$q.screen.gt.xs">建國中學班聯會法律與公文系統</span>
          <span class="q-pl-sm" v-else>建中班聯會法律與公文系統</span>
        </q-toolbar-title>

        <q-btn v-if="$q.screen.gt.xs" :icon="Dark.isActive ? 'dark_mode' : 'nights_stay'" flat @click="toggleDark" />
        <q-btn v-if="$q.screen.gt.xs" flat icon="fullscreen" @click="toggleFullscreen" />
        <q-btn v-if="$q.screen.gt.xs && !loggedIn" align="right" dense flat icon="login" @click="login()">登入</q-btn>
        <q-btn v-if="$q.screen.gt.xs && loggedIn" align="right" dense flat icon="logout" @click="logout()">登出</q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered show-if-above side="left" style="overflow: hidden">
      <q-list class="menu-list fit column">
        <div v-for="endpoint of endpoints" :key="endpoint.name">
          <q-item
            v-if="(!endpoint.requireAuth || loggedIn) && (endpoint.requireRole === undefined || hasRole(endpoint.requireRole))"
            v-ripple
            :active="selected === endpoint.name"
            :to="endpoint.url"
            @click="changeSelected(endpoint.name)"
          >
            <q-item-section avatar>
              <q-icon :name="endpoint.icon" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ endpoint.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </div>
        <q-space />
        <q-item v-if="!loggedIn" clickable @click="login()">
          <q-item-section avatar>
            <q-icon name="login" />
          </q-item-section>

          <q-item-section>
            <q-item-label>登入</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="loggedIn && loggedInUser !== null && loggedInUser !== undefined">
          <q-item-section v-if="loggedInUser.photoURL !== null" avatar>
            <q-avatar>
              <img :src="loggedInUser.photoURL" alt="profile picture" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label
              >{{ loggedInUser.displayName }}
              {{ loggedInUserClaims.roles?.map((r) => DocumentSpecificIdentity.VALUES[r]?.translation).join('、') }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="loggedIn" clickable @click="logout()">
          <q-item-section avatar>
            <q-icon name="logout" />
          </q-item-section>

          <q-item-section>
            <q-item-label>登出</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useCurrentUser } from 'vuefire';
import { init, loggedInUserClaims, login, logout } from 'src/ts/auth.ts';
import { Dark, LocalStorage } from 'quasar';
import { DocumentSpecificIdentity } from '../ts/models.ts';

init();
const leftDrawerOpen = ref(false);
const endpoints = [
  { name: '檢視法案', url: '/legislation', icon: 'description', requireAuth: false },
  { name: '檢視公文', url: '/document', icon: 'badge', requireAuth: false },
  { name: '編輯法案', url: '/manage/legislation', icon: 'edit', requireAuth: true },
  { name: '編輯公文', url: '/manage/document', icon: 'draw', requireAuth: true },
  { name: '管理帳號', url: '/manage/accounts', icon: 'badge', requireAuth: true, requireRole: DocumentSpecificIdentity.Chairman },
  { name: '關於', url: '/about', icon: 'info', requireAuth: false },
];
const selected = ref('Account Information');
const loggedInUser = useCurrentUser();
const loggedIn = computed(() => loggedInUser.value !== null);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleDark() {
  Dark.toggle();
  LocalStorage.set('dark', Dark.isActive);
}

function changeSelected(name: string) {
  selected.value = name;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
}

function hasRole(role: DocumentSpecificIdentity) {
  return loggedInUserClaims.roles?.includes(role.firebase) || loggedInUser.value?.uid === '5MK7Kr4O9GVg76lHCsy6ex45kP03';
}
</script>
