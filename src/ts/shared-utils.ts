export function randomChars(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export function getReign(date: Date) {
  let year: number;
  if (date.getMonth() < 7) {
    // jan ~ july
    year = date.getFullYear() - 1945 - 1;
  } else {
    year = date.getFullYear() - 1945;
  }
  if (date.getMonth() > 6 || date.getMonth() == 0) {
    // aug ~ jan
    return `${year}-1`;
  }
  return `${year}-2`;
}

export function getCurrentReign() {
  return getReign(new Date());
}

export function convertToChineseDay(day: number) {
  return ['日', '一', '二', '三', '四', '五', '六', '日'][day];
}

// An own property only. A key from a URL or a stored record such as `constructor` would otherwise resolve through the prototype chain to a
// built-in. (Object.hasOwn would do, but the browser target still includes Safari 14, which lacks it.)
export function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Longest `prosecutionId` / `lawsuitRoot` that is followed. Real keys are a 公文字號 or a case number, a dozen characters; the cap only turns
// away garbage before it becomes a document ID or a query value.
const MAX_LAWSUIT_KEY_LENGTH = 200;

// `prosecutionId` is whatever its author wrote, and a lawsuit URL is whatever its visitor typed, so both are checked before use.
export function isLawsuitKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_LAWSUIT_KEY_LENGTH;
}

// Whether Firestore could hold a document under `key`. It answers invalid-argument for `.`, `..` and anything matching `__…__`, and doc()
// reads a `/` as a path separator, so none of those names a document: they are looked up as nothing rather than sent.
export function canNameDocument(key: string): boolean {
  return !key.includes('/') && key !== '.' && key !== '..' && !/^__[\s\S]*__$/.test(key);
}
