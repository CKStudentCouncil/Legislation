import { escapeHtml, getMailTemplate } from './template';

export function amendmentNotificationMail(
  legislationName: string,
  petitionerName: string,
  petitionerEmail: string | undefined,
  reviewUrl: string,
  reviewerTitle: string,
) {
  const lines = [`系統收到一份針對 <strong>${escapeHtml(legislationName)}</strong> 的修正草案。`, `提案人：${escapeHtml(petitionerName)}`];
  if (petitionerEmail) {
    lines.push(`聯絡信箱：${escapeHtml(petitionerEmail)}`);
  }

  return getMailTemplate({
    title: '新的修正草案審查請求',
    titleLink: reviewUrl,
    greeting: `${reviewerTitle} 您好，`,
    contentLines: lines,
    actionMessage: '請點擊下方按鈕前往草案審查系統查看詳細內容與比較表，並進行核可或退回操作：',
    actionText: '查看修正草案',
    actionLink: reviewUrl,
  });
}
