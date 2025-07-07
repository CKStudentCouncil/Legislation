<template>
  <q-no-ssr>
    <q-header class="bg-primary text-white no-print" elevated height-hint="98">
      <q-toolbar>
        <q-btn aria-label="收合側選單" dense flat icon="menu" round @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img alt="favicon" src="/icon.png" height="38" width="38" />
          </q-avatar>
          <span v-if="$q.screen.gt.xs" class="q-pl-sm">建國中學班聯會法律與公文系統</span>
          <span v-else class="q-pl-sm">建中班聯會法律與公文系統</span>
        </q-toolbar-title>

        <q-btn v-if="$q.screen.gt.xs" :icon="Dark.isActive ? 'dark_mode' : 'nights_stay'" flat @click="toggleDark" aria-label="切換暗色模式" />
        <q-btn v-if="$q.screen.gt.xs" flat icon="fullscreen" @click="toggleFullscreen" aria-label="切換全螢幕" />
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
            :title="endpoint.name"
            role="link"
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
              <img :src="loggedInUser.photoURL" alt="profile picture" height="40" width="40" />
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
  </q-no-ssr>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { init, loggedInUserClaims, login, logout, useCurrentUser } from 'src/ts/auth.ts';
import { Dark, LocalStorage } from 'quasar';
import { DocumentSpecificIdentity } from '../ts/models.ts';

onMounted(() => {
  init();
});
const leftDrawerOpen = ref(false);
const endpoints = [
  { name: '檢視法令', url: '/legislation', icon: 'gavel', requireAuth: false },
  { name: '檢視公文', url: '/document', icon: 'description', requireAuth: false },
  { name: '編輯法令', url: '/manage/legislation', icon: 'edit', requireAuth: true },
  { name: '編輯公文', url: '/manage/document', icon: 'draw', requireAuth: true },
  { name: '評委文書', url: '/document/judicial', icon: 'balance', requireAuth: false },
  { name: '管理帳號', url: '/manage/accounts', icon: 'badge', requireAuth: true, requireRole: DocumentSpecificIdentity.Chairman },
  { name: '關於與使用條款', url: '/about', icon: 'info', requireAuth: false },
];
const selected = ref('Account Information');
const loggedInUser = useCurrentUser();
const loggedIn = computed(() => !!loggedInUser.value);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleDark() {
  Dark.toggle();
  LocalStorage.set('dark', Dark.isActive);
  if (!Dark.isActive) {
    document.querySelector('#mainframe')?.classList.remove('auto-dark');
  }
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
