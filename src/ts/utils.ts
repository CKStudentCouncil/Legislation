import { Notify } from 'quasar';
import type { DocumentType } from './models';
import { DocumentSpecificIdentity } from './models';
import { useFunctionAsync } from 'boot/vuefire.ts';
import { exception } from 'vue-gtag';

export function generateHistoryContentId(refDate: Date, existingIds: string[]): string {
  const utc8 = new Date(refDate.getTime() + 8 * 60 * 60 * 1000);
  const year = utc8.getUTCFullYear().toString();
  const month = (utc8.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = utc8.getUTCDate().toString().padStart(2, '0');
  const dateStr = year + month + day;
  let counter = 1;
  while (existingIds.includes(dateStr + counter)) {
    counter++;
  }
  return dateStr + counter;
}

export function copyLink(href?: string | number | null) {
  void copyText(location.protocol + '//' + location.host + location.pathname + (href ? '?c=' + href.toString() : ''));
}

export function copyLawLink(id: string) {
  void copyText(window.location.origin + (window.location.origin.endsWith('/') ? '' : '/') + 'legislation/' + id);
}

export function copyDocLink(id: string) {
  void copyText(window.location.origin + (window.location.origin.endsWith('/') ? '' : '/') + 'document/' + id);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    notifySuccess('已複製連結');
  } catch (e) {
    notifyError('無法複製連結', e);
  }
}

export function translateNumber(str: string) {
  //@formatter:off
  const numChar = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  } as Record<string, number>;
  const levelChar = {
    十: 10,
    百: 100,
    千: 1000,
  } as Record<string, number>;
  //@formatter:on
  if (str.startsWith('十')) str = '一' + str;
  const ary = Array.from(str);
  let temp = 0;
  for (let i = 0; i < ary.length; i++) {
    const char = ary[i];
    if (char === '零') continue;
    const next = ary[i + 1];
    if (next) {
      temp += numChar[char!]! * levelChar[next]!;
      i++;
    } else {
      temp += numChar[char!]!;
    }
  }
  return temp;
}

export function translateNumberToChinese(num: number) {
  const numChar = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const levelChar = ['', '十', '百', '千'];
  const ary = Array.from(num.toString());
  let temp = '';
  for (let i = 0; i < ary.length; i++) {
    const char = ary[i];
    if (char === '0') {
      temp += '零';
      continue;
    }
    temp += numChar[parseInt(char!)]! + levelChar[ary.length - i - 1]!;
  }
  if (temp.startsWith('一十')) temp = temp.slice(1);
  if (temp.length > 1 && temp.endsWith('零')) temp = temp.slice(0, -1);
  return temp;
}

export function getReadableRecipient(specific: DocumentSpecificIdentity[], others: string[]) {
  let s = '';
  for (let i = 0; i < specific.length; i++) {
    if (specific[i]!.firebase == DocumentSpecificIdentity.Other.firebase) {
      s += others.join('、');
    } else {
      s = s.concat(specific[i]!.translation);
    }
    if (i < specific.length - 1) {
      s += '、';
    }
  }
  return s;
}

export async function generateDocumentIdNumber(specific: DocumentSpecificIdentity, type: DocumentType) {
  // e.g. 07620000001，1.公文之文號,由十二碼組成,前三碼為屆次,第四碼為期間次,第五碼為部門碼,第六、七碼為機關碼,第八碼為該公文類型,後四碼為流水號。
  // Computing the next serial requires scanning every document of this type — including confidential
  // ones the caller cannot read — so a client list query is (rightly) blocked by firestore.rules.
  // The generateDocumentId Cloud Function does it with the Admin SDK and returns only the number.
  const generateDocumentId = await useFunctionAsync('generateDocumentId');
  const result = await generateDocumentId({ fromSpecific: specific.firebase, type: type.firebase });
  return (result.data as { idNumber: string }).idNumber;
}

export async function htmlToText(html: string, wordwrap: number = 130) {
  const { convert } = await import('html-to-text');
  return convert(html, { wordwrap });
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>?/gm, '');
}

export function getMeta(title?: string, desc?: string) {
  const parsedTitle = title ? `${title} - 建國中學班聯會法律與公文系統` : '建國中學班聯會法律與公文系統';
  const description = desc ?? '建國中學班聯會內憲章、法律、命令、公文之中央儲存資料庫';
  return {
    title: {
      name: 'title',
      content: parsedTitle,
    },
    ogTitle: {
      property: 'og:title',
      content: parsedTitle,
    },
    twitterTitle: {
      name: 'twitter:title',
      content: parsedTitle,
    },
    description: {
      name: 'description',
      content: description,
    },
    ogDesc: {
      property: 'og:description',
      content: description,
    },
    twitterDesc: {
      name: 'twitter:description',
      content: description,
    },
  };
}

export function notifySuccess(message: string): void {
  Notify.create({
    message,
    color: 'positive',
    icon: 'check_circle',
    position: 'top',
  });
}

export function notifyError(message: string, e?: any): void {
  Notify.create({
    message,
    color: 'negative',
    icon: 'report_problem',
    position: 'top',
  });
  if (e) {
    console.error(e);
    exception({
      description: message + ': ' + e?.message,
      fatal: false,
      stack: e?.stack,
    });
  }
}
