import { getMailTemplate } from './template';

// Defense-in-depth: the subject is the document's own field (the granter cannot supply a custom
// message), but it is still user-authored, so escape it before embedding in the HTML email.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function accessGrantedMail(id: string, subject: string) {
  const safeSubject = escapeHtml(subject ?? '');
  const link = `https://law.cksc.tw/document/${id}`;
  return getMailTemplate({
    title: '您已獲授公文存取權限',
    titleLink: link,
    greeting: '您好，',
    contentLines: [
      `您已獲授本會公文「${safeSubject}」的存取權限。`,
      '若您認為此為誤授，請忽略本郵件或聯繫該公文之發起人。',
    ],
    actionMessage: `若要檢視該公文，請至<a href="${link}" rel="noopener" style="text-decoration: underline; color: #0068A5;" target="_blank">本會法律與公文系統</a>查閱。`,
    actionText: '前往查閱',
    actionLink: link,
  });
}
