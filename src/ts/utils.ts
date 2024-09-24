import { Notify } from 'quasar';

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
    position: 'top',
  });
}

export function translateNumber(str: string) {
  //@formatter:off
  const numChar = {
    '零': 0,
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
  } as Record<string, number>;
  const levelChar = {
    '十': 10,
    '百': 100,
    '千': 1000,
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
  if (temp.startsWith('一十')) temp = temp.slice(1);
  return temp;
}
