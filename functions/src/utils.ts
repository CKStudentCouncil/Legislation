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
  if (date.getMonth() < 7) { // jan ~ july
    year = date.getFullYear() - 1945 - 1;
  } else {
    year = date.getFullYear() - 1945;
  }
  if (date.getMonth() > 6 || date.getMonth() == 0) { // aug ~ jan
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
