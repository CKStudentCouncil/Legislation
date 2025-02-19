import * as models from 'src/ts/models.ts';
import { DocumentConfidentiality, documentsCollection, DocumentSpecificIdentity, DocumentType } from 'src/ts/models.ts';
import { generateDocumentIdNumber, getCurrentReign } from 'src/ts/utils.ts';
import { meetingNoticeTemplate, meetingRecordTemplate } from 'src/ts/template.ts';
import { doc, setDoc } from 'firebase/firestore';

export function getEmptyDocument() {
  const adding = {} as models.Document;
  adding.type = models.DocumentType.Advisory;
  adding.reign = getCurrentReign();
  adding.fromSpecific = DocumentSpecificIdentity.Speaker;
  adding.toSpecific = [DocumentSpecificIdentity.StudentCouncilRepresentative];
  adding.toOther = [];
  adding.ccSpecific = [DocumentSpecificIdentity.Chairman, DocumentSpecificIdentity.ViceChairman, DocumentSpecificIdentity.JudicialCommitteeMember];
  adding.ccOther = [];
  adding.subject = '';
  adding.content = '';
  adding.attachments = [];
  adding.createdAt = new Date();
  adding.confidentiality = DocumentConfidentiality.Public;
  adding.read = [];
  adding.published = false;
  return adding;
}

export async function create(adding: models.Document, template = true) {
  if (adding.type.judicialCommitteeOnly) {
    if (adding.type.firebase == DocumentType.JudicialCommitteeExplanation.firebase) {
      adding.idPrefix = adding.type.prefix + '字';
    } else {
      adding.idPrefix = adding.fromSpecific.prefix + adding.type.prefix + '字';
    }
  } else {
    adding.idPrefix = adding.fromSpecific.generic.prefix + adding.fromSpecific.prefix + adding.type.prefix + '字';
  }
  adding.createdAt = new Date();
  adding.publishedAt = null;
  switch (adding.type.firebase) {
    case models.DocumentType.MeetingNotice.firebase:
      if (template) adding.content = meetingNoticeTemplate();
      break;
    case models.DocumentType.Record.firebase:
      adding.toSpecific = [];
      adding.toOther = [];
      adding.ccSpecific = [];
      adding.ccOther = [];
      adding.confidentiality = DocumentConfidentiality.Public;
      if (template) adding.content = meetingRecordTemplate();
      break;
    case models.DocumentType.Order.firebase:
    case models.DocumentType.Announcement.firebase:
    case models.DocumentType.JudicialCommitteeExplanation.firebase:
    case models.DocumentType.JudicialCommitteeDecision.firebase:
      adding.toSpecific = [];
      adding.toOther = [];
      adding.ccSpecific = [];
      adding.ccOther = [];
      adding.confidentiality = DocumentConfidentiality.Public;
      break;
  }
  if (!adding.idNumber) adding.idNumber = await generateDocumentIdNumber(adding.fromSpecific, adding.type);
  const id = adding.idPrefix + '第' + adding.idNumber + '號';
  await setDoc(doc(documentsCollection(), id), adding);
  return id;
}
