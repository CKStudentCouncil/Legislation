export function isUrl(s: string) {
  return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/.test(s) || '請輸入有效的網址';
}

export function optionalDate(s: string) {
 return !s || /^-?\d+\/[0-1]\d\/[0-3]\d$/.test(s) || '請輸入有效的日期'
}

export function isNumber(s: string) {
  return /^\d+$/.test(s) || '請輸入阿拉伯數字';
}
