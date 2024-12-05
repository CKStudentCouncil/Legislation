import { Notify } from 'quasar';
import { documentsCollection, DocumentSpecificIdentity, DocumentType } from './models';
import { getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import sanitize from 'sanitize-html';

export function copyLink(href?: string) {
  copyText(window.location.href.split('#')[0] + (href ? '#' + href : ''));
}

export function copyLawLink(id: string) {
  copyText(window.location.origin + (window.location.origin.endsWith('/') ? '' : '/') + 'legislation/' + id);
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text);
  Notify.create({
    message: '已複製到剪貼簿',
    color: 'positive',
    position: 'top'
  });
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
      temp += numChar[char] * levelChar[next];
      i++;
    } else {
      temp += numChar[char];
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
    temp += numChar[parseInt(char)] + levelChar[ary.length - i - 1];
  }
  if (temp.startsWith('一十')) temp = temp.slice(1)
  if (temp.length > 1 && temp.endsWith('零')) temp = temp.slice(0, -1);
  return temp;
}

export function getReign(date: Date) {
  return `${date.getFullYear() - 1945}-${date.getMonth() > 7 || date.getMonth() < 1 ? '1' : '2'}`; // August to January
}

export function getCurrentReign() {
  return getReign(new Date());
}

export function getReadableRecipient(specific: DocumentSpecificIdentity[], others: string[]) {
  let s = '';
  for (let i = 0; i < specific.length; i++) {
    if (specific[i].firebase == DocumentSpecificIdentity.Other.firebase) {
      s += others.join('、');
    } else {
      s = s.concat(specific[i].translation);
    }
    if (i < specific.length - 1) {
      s += '、';
    }
  }
  return s;
}

export async function generateDocumentIdNumber(specific: DocumentSpecificIdentity, type: DocumentType) {
  //e.g. 07620000001，1.公文之文號,由十二碼組成,前三碼為屆次,第四碼為期間次,第五碼為部門碼,第六、七碼為機關碼,第八碼為該公文類型,後四碼為流水號。
  let r = getCurrentReign().replace('-', '');
  if (r.length === 3) {
    r = '0' + r;
  }
  let s = r + specific.generic.code + specific.code;
  const lastDoc = await getDocs(query(documentsCollection(),
    orderBy('createdAt', 'desc'),
    where('fromSpecific', '==', specific.firebase),
    where('type', '==', type.firebase),
    limit(1)));
  if (lastDoc.docs.length > 0 && lastDoc.docs[0].exists() && lastDoc.docs[0].data()?.idNumber.startsWith(r)) {
    const lastDocId = lastDoc.docs[0].id;
    const lastDocIdNumber = parseInt(lastDocId.slice(-4));
    s += (lastDocIdNumber + 1).toString().padStart(4, '0');
  } else {
    s += '0001';
  }
  return s;
}

export function customSanitize(text: string) {
  return sanitize(text, {
    allowedTags: sanitize.defaults.allowedTags.concat(['font']),
    allowedAttributes: Object.assign(sanitize.defaults.allowedAttributes, {
      font: ['color', 'size'],
      div: ['style']
    }),
    allowedStyles: {
      '*': {
        // Match HEX and RGB
        'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
        'text-align': [/^left$/, /^right$/, /^center$/],
        // Match any number with px, em, or %
        'font-size': [/^\d+(?:px|em|%)$/]
      },
      'p': {
        'font-size': [/^\d+rem$/]
      }
    }
  })
}
