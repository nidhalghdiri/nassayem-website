// ─────────────────────────────────────────────────────────────────────────────
// Defined equipment issues — single source for the technician scan flow
// (/admin/maintenance/scan) and the "New maintenance request" form.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

export const ISSUE_OPTIONS_EN = [
  "Not Cooling/Heating",
  "Leaking",
  "No Power / Won't Turn On",
  "Unusual Noise",
  "Physical Damage",
  "Routine Maintenance Required",
  "Other",
];

export const ISSUE_OPTIONS_AR = [
  "لا يبرد / لا يسخن",
  "تسريب",
  "لا يوجد طاقة / لا يعمل",
  "صوت غير طبيعي",
  "ضرر فيزيائي",
  "صيانة دورية مطلوبة",
  "أخرى",
];

/** "Other" — the free-text issue; the details field is mandatory for it. */
export function isOtherIssue(issue: string): boolean {
  return issue === "Other" || issue === "أخرى";
}

export function isKnownIssue(issue: string): boolean {
  return ISSUE_OPTIONS_EN.includes(issue) || ISSUE_OPTIONS_AR.includes(issue);
}
