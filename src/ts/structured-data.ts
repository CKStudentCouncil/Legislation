// Builders for schema.org JSON-LD structured data, injected server-side via the
// Quasar Meta plugin `script` channel (see SingleLegislationPage / SingleDocumentPage).
// Treated primarily as an AEO/GEO signal: it gives answer/generative engines explicit
// entity grounding (issuer, dates, identifiers, clause structure) for a primary-source
// legal corpus. Note: schema.org `Legislation` has no Google rich result — the value is
// machine understanding and LLM citation accuracy, not SERP enhancements.

import type { Document, Legislation } from './models';
import { stripHtml } from './utils';

export const SITE = 'https://law.cksc.tw';
const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;
const LANG = 'zh-Hant-TW';

type Json = Record<string, unknown>;

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.valueOf()) ? undefined : date.toISOString();
}

/** The student council, used as publisher/author/legislationPassedBy across the site. */
export function organizationNode(): Json {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: '建國中學班聯會',
    alternateName: '臺北市立建國高級中學班聯會法律與公文系統',
    url: SITE,
    logo: `${SITE}/og-image.png`,
    parentOrganization: {
      '@type': 'EducationalOrganization',
      name: '臺北市立建國高級中學',
    },
  };
}

/** CollectionPage + ItemList for an SSR listing page (公文/法令 index). Gives answer
 *  engines an explicit, ordered set of the page's primary entities. */
export function itemListJsonLd(items: { name: string; url: string }[], list: { name: string; url: string }): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': list.url,
    url: list.url,
    name: list.name,
    inLanguage: LANG,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        url: it.url,
      })),
    },
  };
}

function breadcrumbNode(items: { name: string; url: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Wrap a JSON-LD object into a Quasar useMeta `script` descriptor, escaping `<`
 *  so user-authored content can never break out of the <script> element. */
export function ldJsonScript(obj: unknown): { type: string; innerHTML: string } {
  return {
    type: 'application/ld+json',
    innerHTML: JSON.stringify(obj).replace(/</g, '\\u003c'),
  };
}

export function legislationJsonLd(l: Legislation, id: string): Json {
  const url = `${SITE}/legislation/${id}`;
  const sorted = [...l.history].sort((a, b) => new Date(a.amendedAt).valueOf() - new Date(b.amendedAt).valueOf());
  const published = toIso(sorted[0]?.amendedAt ?? l.createdAt);
  const modified = toIso(sorted[sorted.length - 1]?.amendedAt ?? l.createdAt);
  const clauses = l.content
    .filter((c) => !c.deleted && c.content)
    .map((c) => ({
      '@type': 'Legislation',
      name: [c.title, c.subtitle].filter(Boolean).join(' ').trim(),
      legislationType: c.type.translation,
      text: c.content,
      position: c.index,
    }));
  const node: Json = {
    '@type': 'Legislation',
    '@id': url,
    url,
    name: l.name,
    legislationType: l.category.type.translation, // 憲章 / 法律 / 命令
    about: l.category.translation,
    legislationIdentifier: id,
    inLanguage: LANG,
    datePublished: published,
    dateModified: modified,
    legislationLegalForce: l.frozenBy ? 'PartiallyInForce' : 'InForce',
    legislationPassedBy: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
  if (l.preface) node.abstract = l.preface;
  if (clauses.length) node.hasPart = clauses;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode(),
      node,
      breadcrumbNode([
        { name: '首頁', url: `${SITE}/` },
        { name: '法令', url: `${SITE}/legislation` },
        { name: l.name, url },
      ]),
    ],
  };
}

export function documentJsonLd(doc: Document, id: string): Json {
  const url = `${SITE}/document/${id}`;
  const fb = doc.type.firebase;
  const isReport = fb.startsWith('Court') || fb.startsWith('JudicialCommittee');
  const published = toIso(doc.publishedAt ?? doc.createdAt);
  const node: Json = {
    '@type': isReport ? 'Report' : 'Article',
    '@id': url,
    url,
    headline: doc.subject,
    name: doc.subject,
    identifier: doc.getFullId(),
    inLanguage: LANG,
    datePublished: published,
    dateModified: toIso(doc.publishedAt ?? doc.createdAt),
    articleBody: stripHtml(doc.content),
    genre: doc.type.translation,
    author: {
      '@type': 'Organization',
      name: doc.fromSpecific.translation,
      parentOrganization: { '@id': ORG_ID },
    },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
  const graph: Json[] = [
    organizationNode(),
    node,
    breadcrumbNode([
      { name: '首頁', url: `${SITE}/` },
      { name: '公文', url: `${SITE}/document` },
      { name: doc.subject, url },
    ]),
  ];
  if (fb === 'MeetingNotice' && doc.meetingTime) {
    graph.push({
      '@type': 'Event',
      name: doc.subject,
      startDate: toIso(doc.meetingTime),
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...(doc.location ? { location: { '@type': 'Place', name: doc.location } } : {}),
      organizer: { '@id': ORG_ID },
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
