<template>
  <q-no-ssr>
    <q-header class="bg-primary text-white no-print" elevated height-hint="98">
      <q-toolbar>
        <q-btn aria-label="收合側選單" dense flat :icon="matMenu" round @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img alt="favicon" src="/icon.webp" height="38" width="38" />
          </q-avatar>
          <span v-if="$q.screen.gt.xs" class="q-pl-sm">建國中學班聯會法律與公文系統</span>
          <span v-else class="q-pl-sm">建中班聯會法律與公文系統</span>
        </q-toolbar-title>

        <q-btn v-if="$q.screen.gt.xs" :icon="Dark.isActive ? matDarkMode : matNightsStay" flat @click="toggleDark" aria-label="切換暗色模式" />
        <q-btn v-if="$q.screen.gt.xs" flat :icon="matFullscreen" @click="toggleFullscreen" aria-label="切換全螢幕" />
        <q-btn v-if="$q.screen.gt.xs && !loggedIn" align="right" dense flat :icon="matLogin" @click="login()">登入</q-btn>
        <q-btn v-if="$q.screen.gt.xs && loggedIn" align="right" dense flat :icon="matLogout" @click="logout()">登出</q-btn>
      </q-toolbar>
    </q-header>
    <q-drawer v-model="leftDrawerOpen" bordered show-if-above side="left" style="overflow: hidden">
      <q-list class="menu-list fit column">
        <div v-for="endpoint of endpoints" :key="endpoint.name">
          <q-item
            v-if="(!endpoint.requireAuth || loggedIn) && (endpoint.requireRole === undefined || hasRole(endpoint.requireRole))"
            v-ripple
            :active="selected === endpoint.name"
            v-bind="endpointLinkProps(endpoint)"
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
            <q-icon :name="matLogin" />
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
            <q-icon :name="matLogout" />
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
import { matBadge, matBalance, matDarkMode, matDescription, matDraw, matEdit, matFullscreen, matGavel, matInfo, matLogin, matLogout, matMenu, matNightsStay } from '@quasar/extras/material-icons';
import { computed, onMounted, ref } from 'vue';
import { init, loggedInUserClaims, login, logout, useCurrentUser } from 'src/ts/auth.ts';
import { isModuleLoadError, recoverFromModuleLoadError } from 'boot/chunk-recovery.ts';
import { captureError } from 'boot/sentry.ts';
import { Dark, LocalStorage } from 'quasar';
import { DocumentSpecificIdentity } from '../ts/models.ts';

type Endpoint = {
  name: string;
  url: string;
  icon: string;
  requireAuth: boolean;
  external?: boolean;
  requireRole?: DocumentSpecificIdentity[];
};

onMounted(() => {
  // firebase/auth is the one lazy import every visitor triggers, on every page, whether or
  // not they ever sign in — and it is one of the few the build leaves as a bare import(),
  // so the vite:preloadError handler in boot/chunk-recovery.ts never sees it. Left floating
  // it abandons the header signed-out and files an unhandled rejection with no stack, which
  // is what Sentry kept receiving. Recover from a lost chunk; report anything else, which is
  // a real failure of initializeAuth() and would not be helped by loading the page again.
  init().catch((error: unknown) => {
    if (isModuleLoadError(error) && recoverFromModuleLoadError()) return;
    captureError(error, '無法載入登入狀態');
  });
});
const leftDrawerOpen = ref(false);
const endpoints: Endpoint[] = [
  { name: '檢視法令', url: '/legislation', icon: matGavel, requireAuth: false },
  { name: '檢視公文', url: '/document', icon: matDescription, requireAuth: false },
  { name: '編輯法令', url: '/manage/legislation', icon: matEdit, requireAuth: true },
  { name: '編輯公文', url: '/manage/document', icon: matDraw, requireAuth: true },
  { name: '評委文書', url: '/document/judicial', icon: matBalance, requireAuth: false },
  {
    name: '管理帳號',
    url: '/manage/accounts',
    icon: matBadge,
    requireAuth: true,
    requireRole: [DocumentSpecificIdentity.Chairman, DocumentSpecificIdentity.Speaker, DocumentSpecificIdentity.JudicialCommitteeChairman],
  },
  { name: '聲請平台', url: 'https://script.google.com/macros/s/AKfycbx_cfNnV_ZzRh9hBFnX_2XBlILjnVsIO7dUomrCAF1-fHuCHTq2njYi-b-pQT2yC5G2/exec', icon: matGavel, external: true, requireAuth: false },
  { name: '關於與使用條款', url: '/about', icon: matInfo, requireAuth: false },
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
  const isExternal = endpoints.some((e) => e.name === name && e.external === true);
  if (isExternal) {
    return;
  }
  selected.value = name;
}

function endpointLinkProps(endpoint: { url: string; external?: boolean }) {
  if (endpoint.external) {
    return {
      href: endpoint.url,
      target: '_blank',
      rel: 'noopener noreferrer',
    };
  }

  return {
    to: endpoint.url,
  };
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen();
  }
}

function hasRole(role: DocumentSpecificIdentity | DocumentSpecificIdentity[]) {
  if (loggedInUser.value?.uid === '5MK7Kr4O9GVg76lHCsy6ex45kP03') return true;
  if (Array.isArray(role)) {
    return role.some((r) => loggedInUserClaims.roles?.includes(r.firebase));
  }
  return loggedInUserClaims.roles?.includes(role.firebase);
}
</script>
