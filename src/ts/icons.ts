/**
 * Ligature-name -> SVG path bridge for icons that originate in `src/ts/models.ts`.
 *
 * The app renders icons as SVG (quasar.config.ts ships no `material-icons` webfont and sets
 * `iconSet: 'svg-material-icons'`), so QIcon needs path data, not a ligature string. Wherever
 * an icon name is written literally in a template we now import its `mat*` constant directly
 * — but the enum classes in models.ts carry theirs as plain strings, and models.ts is part of
 * the Cloud Functions shared contract. Functions have no `@quasar/extras` dependency and must
 * not grow one, so models.ts keeps its ligature names and the view layer translates them here.
 *
 * Add an icon to an enum in models.ts and you must add it here too: an unmapped name falls
 * through unchanged and QIcon renders it as literal text rather than a glyph.
 */
import { matAccountCircle, matAssignment, matAssuredWorkload, matBadge, matBalance, matBook, matCampaign, matConnectWithoutContact, matConstruction, matDescription, matEditNote, matEmergency, matFlag, matGavel, matGroups, matHardware, matHowToVote, matLocalPolice, matNotifications, matReceiptLong, matSettingsAccessibility } from '@quasar/extras/material-icons';

const SVG_BY_LIGATURE: Record<string, string> = {
  account_circle: matAccountCircle,
  assignment: matAssignment,
  assured_workload: matAssuredWorkload,
  badge: matBadge,
  balance: matBalance,
  book: matBook,
  campaign: matCampaign,
  connect_without_contact: matConnectWithoutContact,
  construction: matConstruction,
  description: matDescription,
  edit_note: matEditNote,
  emergency: matEmergency,
  flag: matFlag,
  gavel: matGavel,
  groups: matGroups,
  hardware: matHardware,
  how_to_vote: matHowToVote,
  local_police: matLocalPolice,
  notifications: matNotifications,
  receipt_long: matReceiptLong,
  settings_accessibility: matSettingsAccessibility,
};

/** Resolve a models.ts ligature name to SVG path data; passes unknown names through. */
export function icon(name: string): string;
export function icon(name: string | undefined): string | undefined;
export function icon(name: string | undefined): string | undefined {
  return name === undefined ? undefined : (SVG_BY_LIGATURE[name] ?? name);
}
