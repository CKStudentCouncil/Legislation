// eslint-disable-next-line require-jsdoc
export function randomChars(length: number) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export function getReign(date: Date) {
  if (date.getMonth() > 7 || date.getMonth() < 1) { // -1
    return `${date.getFullYear() - 1945}-1`
  }
  return `${date.getFullYear() - 1945 - 1}-2`;
}

export function getCurrentReign() {
  return getReign(new Date());
}
