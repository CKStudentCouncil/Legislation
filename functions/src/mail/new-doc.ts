import { escapeHtml, getMailTemplate } from './template';

export function newDocMail(id: string, subject: string, user: string, from: string) {
  const link = `https://law.cksc.tw/document/${encodeURIComponent(id)}`;
  return getMailTemplate({
    title: '您收到了新公文',
    titleLink: link,
    greeting: `${user} 您好，`,
    contentLines: [`您收到了一封來自${from}的新公文，主旨「${escapeHtml(subject)}」。`],
    actionMessage: `若要檢視其內容，請至<a href="${link}" rel="noopener" style="text-decoration: underline; color: #0068A5;" target="_blank">本會法律與公文系統</a>查閱。`,
    actionText: '至公文系統查閱',
    actionLink: link,
  });
}
