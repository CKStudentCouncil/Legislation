import { getMailTemplate, MailTemplateOptions } from './template';

export function amendmentResolvedMail(
  legislationName: string,
  petitionerName: string,
  status: 'approved' | 'rejected',
  reason?: string,
  documentUrl?: string,
  legislationUrl?: string,
) {
  const isApproved = status === 'approved';

  const contentLines = [
    `您針對 <strong>${legislationName}</strong> 提出的修正草案，審查結果為：<strong>${isApproved ? '已核可並公布' : '已退回'}</strong>。`,
  ];

  if (reason) {
    contentLines.push(`審查意見 / 退回理由：<br>${reason.replace(/\n/g, '<br>')}`);
  }

  const options: MailTemplateOptions = {
    title: `修正草案審查結果：${isApproved ? '核可' : '退回'}`,
    greeting: `${petitionerName} 您好，`,
    contentLines,
  };

  if (isApproved && documentUrl) {
    options.actionMessage = '您的修正草案已由系統自動合併至法規，並發布對應之命令公文。可前往系統查看。';
    options.actionText = '查看發布公文';
    options.actionLink = documentUrl;
    if (legislationUrl) {
      options.actionText2 = '查看法規條文';
      options.actionLink2 = legislationUrl;
    }
  }

  return getMailTemplate(options);
}
