import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/legislation',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/legislation/view/LegislationPage.vue') },
      { path: ':id', component: () => import('pages/legislation/view/SingleLegislationPage.vue') },
    ],
  },
  {
    path: '/manage',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: 'legislation',
        children: [
          { path: '', component: () => import('pages/manage/legislation/ManageLegislationPage.vue') },
          { path: ':id', component: () => import('pages/manage/legislation/ManageSingleLegislationPage.vue') }
        ],
      },
      {
        path: 'document',
        children: [
          { path: '', component: () => import('pages/manage/document/ManageDocumentsPage.vue') },
          { path: 'from_template', component: () => import('pages/manage/document/ManageCreateDocumentFromTemplatePage.vue') },
          { path: ':id', component: () => import('pages/manage/document/ManageSingleDocumentPage.vue') }
        ],
      },
      {
        path: 'accounts',
        children: [
          { path: '', component: () => import('pages/manage/ManageAccountsPage.vue') },
        ],
      },
    ],
  },
  {
    path: '/document',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/documents/DocumentsPageV2.vue') },
      { path: ':id', component: () => import('pages/documents/SingleDocumentPage.vue') },
    ],
  },
  {
    path: '/about',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/AboutPage.vue') }],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/legislation/view/LegislationPage.vue') }],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
