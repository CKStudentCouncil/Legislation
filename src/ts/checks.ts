export function isUrl(s: string) {
  return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/.test(s) || '請輸入有效的網址';
}

// The shape `mask="date"` (and q-date) produce: YYYY/MM/DD. Half-typed input never matches, which is
// what keeps an unfinished date out of a Firestore query.
const DATE_INPUT = /^-?\d+\/[0-1]\d\/[0-3]\d$/;

/**
 * Parses a `YYYY/MM/DD` filter value, returning null for anything incomplete (`2026/01/0`, mid-typing)
 * or impossible (`2026/19/39`). Never hand an Invalid Date to Firestore: `where()` converts the Date
 * to a Timestamp eagerly and throws `RangeError: Invalid Date` out of whatever built the query.
 */
export function parseDateInput(s: string | null | undefined, endOfDay = false): Date | null {
  if (!s || !DATE_INPUT.test(s)) return null;
  const parsed = new Date(endOfDay ? `${s} 23:59:59` : s);
  return isNaN(parsed.valueOf()) ? null : parsed;
}

export function optionalDate(s: string) {
  return !s || !!parseDateInput(s) || '請輸入有效的日期';
}

export function isReign(s: string) {
  return /^\d+-\d$/.test(s) || '請輸入有效的屆次';
}

export function isNumber(s: string) {
  return /^\d+$/.test(s) || '請輸入阿拉伯數字';
}
