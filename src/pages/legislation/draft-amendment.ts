import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LegislationContent } from 'src/ts/models';

export type AmendmentType = 'partial' | 'full';

export interface DraftContent {
  id: string; // unique ID for dragging
  status: 'unchanged' | 'modified' | 'added' | 'deleted';
  originalIndex?: number; // to reference original content
  originalContent?: LegislationContent; // copy of original for diffing
  current: LegislationContent;
  comment: string;
}

export interface DraftDocument {
  id: string;
  name: string;
  updatedAt: number;
  amendmentType: AmendmentType;
  partialContent: DraftContent[];
  fullContent: LegislationContent[];
}

export interface DraftImportPayload {
  version: number;
  legislationId?: string;
  name?: string;
  amendmentType?: AmendmentType;
  partialContent?: DraftContent[];
  fullContent?: LegislationContent[];
}

export type DraftImportResult =
  | {
      status: 'imported';
      name: string;
    }
  | {
      status: 'redirect';
      legislationId: string;
    };

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const useDraftAmendmentStore = defineStore('draft-amendment', () => {
  const drafts = ref<DraftDocument[]>([]);
  const activeDraftId = ref<string | null>(null);

  // Active Draft Pointers (for backwards compatibility mostly, or active editor)
  const amendmentType = ref<AmendmentType | null>(null);
  const partialContent = ref<DraftContent[]>([]);
  const fullContent = ref<LegislationContent[]>([]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const createDraftItemId = () => generateId();

  const createInitialPartialContent = (baseContent: LegislationContent[]): DraftContent[] => {
    return baseContent.map((content) => ({
      id: generateId(),
      status: 'unchanged',
      originalIndex: content.index,
      originalContent: deepClone(content),
      current: deepClone(content),
      comment: '',
    }));
  };

  const createDraftFromLegislation = (legislationId: string, name: string, type: AmendmentType, baseContent: LegislationContent[]) => {
    if (type === 'full') {
      createNewDraft(legislationId, name, 'full', deepClone(baseContent));
      return;
    }
    createNewDraft(legislationId, name, 'partial', [], createInitialPartialContent(baseContent));
  };

  const loadDrafts = (legislationId: string) => {
    const key = `draft-amendments-${legislationId}`;
    let loadedDrafts: DraftDocument[] = [];

    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        loadedDrafts = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse draft amendments list', e);
      }
    }

    drafts.value = loadedDrafts;
    quitDraft(); // Ensure we load into the disconnected state
  };

  const saveToLocalStorage = (legislationId: string) => {
    if (drafts.value.length === 0) {
      window.localStorage.removeItem(`draft-amendments-${legislationId}`);
    } else {
      window.localStorage.setItem(`draft-amendments-${legislationId}`, JSON.stringify(drafts.value));
    }
  };

  const createNewDraft = (
    legislationId: string,
    name: string,
    type: AmendmentType,
    initialFullContent: LegislationContent[] = [],
    initialPartialContent: DraftContent[] = [],
  ) => {
    const newDraft: DraftDocument = {
      id: generateId(),
      name,
      updatedAt: Date.now(),
      amendmentType: type,
      partialContent: initialPartialContent,
      fullContent: initialFullContent,
    };
    drafts.value.unshift(newDraft);
    saveToLocalStorage(legislationId);
    selectDraft(newDraft.id);
  };

  const selectDraft = (id: string) => {
    const draft = drafts.value.find((d) => d.id === id);
    if (draft) {
      activeDraftId.value = draft.id;
      amendmentType.value = draft.amendmentType;
      partialContent.value = deepClone(draft.partialContent); // Work on a clone
      fullContent.value = deepClone(draft.fullContent); // Work on a clone
    }
  };

  const saveActiveDraft = (legislationId: string) => {
    if (!activeDraftId.value || !amendmentType.value) return;

    const draftIndex = drafts.value.findIndex((d) => d.id === activeDraftId.value);
    if (draftIndex !== -1) {
      const draft = drafts.value[draftIndex]!;

      const newPartialStr = JSON.stringify(partialContent.value);
      const newFullStr = JSON.stringify(fullContent.value);
      const oldPartialStr = JSON.stringify(draft.partialContent);
      const oldFullStr = JSON.stringify(draft.fullContent);

      if (draft.amendmentType !== amendmentType.value || newPartialStr !== oldPartialStr || newFullStr !== oldFullStr) {
        // Update by pointer mutation
        draft.updatedAt = Date.now();
        draft.amendmentType = amendmentType.value;
        draft.partialContent = JSON.parse(newPartialStr);
        draft.fullContent = JSON.parse(newFullStr);
        saveToLocalStorage(legislationId);
      }
    }
  };

  const syncPartialContentWithLive = (liveContent: LegislationContent[]) => {
    if (amendmentType.value !== 'partial') return;
    for (const item of partialContent.value) {
      const liveClause = liveContent.find((content) => content.index === item.originalIndex);
      if (!liveClause) continue;
      item.originalContent = deepClone(liveClause);
      if (item.status === 'unchanged') {
        item.current = deepClone(liveClause);
      }
    }
  };

  const markPartialDeleted = (index: number) => {
    const item = partialContent.value[index];
    if (!item) return;
    if (item.status === 'unchanged' || item.status === 'modified') {
      item.status = 'deleted';
    }
  };

  const restorePartial = (index: number) => {
    const item = partialContent.value[index];
    if (!item) return;
    item.status = 'unchanged';
    if (item.originalContent) {
      item.current = deepClone(item.originalContent);
    }
    item.comment = '';
  };

  const removePartial = (index: number) => {
    partialContent.value.splice(index, 1);
  };

  const removeFullContent = (index: number) => {
    fullContent.value.splice(index, 1);
    for (let i = 0; i < fullContent.value.length; i++) {
      fullContent.value[i]!.index = i;
    }
  };

  const ensureImportedPartialIds = (items: DraftContent[]) => {
    for (const item of items) {
      if (!item.id) item.id = generateId();
    }
    return items;
  };

  const importDraftPayload = (currentLegislationId: string, payload: DraftImportPayload, baseContent: LegislationContent[]): DraftImportResult => {
    if (payload.version !== 1) {
      throw new Error('Unsupported draft version');
    }

    if (!payload.amendmentType || (payload.amendmentType !== 'partial' && payload.amendmentType !== 'full')) {
      throw new Error('Invalid amendmentType');
    }

    if (payload.legislationId && payload.legislationId !== currentLegislationId) {
      return {
        status: 'redirect',
        legislationId: payload.legislationId,
      };
    }

    const name = payload.name || `${new Date().toLocaleDateString('sv-SE')} 匯入修正草案`;

    if (payload.amendmentType === 'full') {
      createNewDraft(currentLegislationId, name, 'full', deepClone(payload.fullContent ?? []));
      return { status: 'imported', name };
    }

    const importedPartial = ensureImportedPartialIds(deepClone(payload.partialContent ?? []));
    const hasFullSnapshot = importedPartial.some((item) => item.status === 'unchanged');

    if (hasFullSnapshot) {
      createNewDraft(currentLegislationId, name, 'partial', [], importedPartial);
      return { status: 'imported', name };
    }

    const initialPartial = createInitialPartialContent(baseContent);
    for (const imported of importedPartial) {
      if (imported.status === 'modified' || imported.status === 'deleted') {
        const index = initialPartial.findIndex((item) => item.originalIndex === imported.originalIndex);
        if (index !== -1) {
          initialPartial[index] = imported;
        }
      } else if (imported.status === 'added') {
        initialPartial.push(imported);
      }
    }

    createNewDraft(currentLegislationId, name, 'partial', [], initialPartial);
    return { status: 'imported', name };
  };

  const getActiveDraftName = () => {
    return drafts.value.find((draft) => draft.id === activeDraftId.value)?.name || '未命名草案';
  };

  const buildActiveDraftExportPayload = (legislationId: string) => {
    const activeDraftName = getActiveDraftName();
    return {
      version: 1,
      legislationId,
      name: activeDraftName,
      amendmentType: amendmentType.value,
      partialContent:
        amendmentType.value === 'partial'
          ? partialContent.value.map((item) =>
              item.status === 'unchanged' ? ({ status: 'unchanged', id: item.id, originalIndex: item.originalIndex } as any) : item,
            )
          : undefined,
      fullContent: amendmentType.value === 'full' ? fullContent.value : undefined,
    };
  };

  const deleteDraft = (legislationId: string, id: string) => {
    drafts.value = drafts.value.filter((d) => d.id !== id);
    if (activeDraftId.value === id) {
      quitDraft();
    }
    saveToLocalStorage(legislationId);
  };

  const quitDraft = () => {
    activeDraftId.value = null;
    amendmentType.value = null;
    partialContent.value = [];
    fullContent.value = [];
  };

  const renameDraft = (legislationId: string, id: string, newName: string) => {
    const draftIndex = drafts.value.findIndex((d) => d.id === id);
    if (draftIndex !== -1) {
      drafts.value[draftIndex]!.name = newName;
      drafts.value[draftIndex]!.updatedAt = Date.now();
      saveToLocalStorage(legislationId);
    }
  };

  return {
    drafts,
    activeDraftId,
    amendmentType,
    partialContent,
    fullContent,
    createDraftItemId,
    createInitialPartialContent,
    createDraftFromLegislation,
    loadDrafts,
    createNewDraft,
    selectDraft,
    saveActiveDraft,
    syncPartialContentWithLive,
    markPartialDeleted,
    restorePartial,
    removePartial,
    removeFullContent,
    importDraftPayload,
    getActiveDraftName,
    buildActiveDraftExportPayload,
    deleteDraft,
    quitDraft,
    renameDraft,
  };
});
