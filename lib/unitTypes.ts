// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for how apartment TYPES are named and described.
//
// Nassayem's taxonomy is company-specific and partly counter-intuitive:
//   • STUDIO      → a self-contained apartment: bedroom + living room (صالة)
//                   + kitchen (مطبخ) + bathroom.
//   • ONE_BEDROOM → a SINGLE room + private bathroom ONLY — NO living room and
//                   NO kitchen. (This is "غرفة فقط", NOT "غرفة وصالة".)
//
// The chatbot must never guess a layout from the enum name, so the glossary
// below is fed verbatim into its system prompt and the tools attach these
// labels to every unit they return.
// ─────────────────────────────────────────────────────────────────────────────

import type { UnitType } from "@prisma/client";

export type UnitTypeLabel = {
  en: string;
  ar: string;
  /** What the type physically includes — used to keep descriptions honest. */
  layoutEn: string;
  layoutAr: string;
};

export const UNIT_TYPE_ORDER: UnitType[] = [
  "STUDIO",
  "ONE_BEDROOM",
  "TWO_BEDROOM",
  "THREE_BEDROOM",
  "VILLA",
];

export const UNIT_TYPE_LABELS: Record<UnitType, UnitTypeLabel> = {
  STUDIO: {
    en: "Studio",
    ar: "استوديو",
    layoutEn: "self-contained apartment: bedroom + living room + kitchen + bathroom",
    layoutAr: "شقة متكاملة: غرفة نوم + صالة + مطبخ + حمام",
  },
  ONE_BEDROOM: {
    en: "Single room",
    ar: "غرفة فقط",
    layoutEn: "one private room + bathroom ONLY — no living room, no kitchen",
    layoutAr: "غرفة + حمام فقط، بدون صالة وبدون مطبخ",
  },
  TWO_BEDROOM: {
    en: "2 Bedrooms",
    ar: "غرفتين وصالة",
    layoutEn: "two bedrooms + living room",
    layoutAr: "غرفتين نوم + صالة",
  },
  THREE_BEDROOM: {
    en: "3 Bedrooms",
    ar: "ثلاث غرف وصالة",
    layoutEn: "three bedrooms + living room",
    layoutAr: "ثلاث غرف نوم + صالة",
  },
  VILLA: {
    en: "Villa",
    ar: "فيلا",
    layoutEn: "villa",
    layoutAr: "فيلا",
  },
};

/**
 * Authoritative unit-type glossary injected into the chatbot's system prompt.
 * It exists specifically to stop the model from re-inventing "غرفة وصالة" for a
 * ONE_BEDROOM (a single room with no living room) — the exact mistake that
 * misled customers.
 */
export function buildUnitTypesGlossary(): string {
  const lines = UNIT_TYPE_ORDER.map((t) => {
    const l = UNIT_TYPE_LABELS[t];
    return `- ${l.ar} / ${l.en} (${t}): ${l.layoutAr} — ${l.layoutEn}.`;
  });
  return `
<unit_types>
Our apartment TYPES use company-specific definitions — some are the OPPOSITE of what the name suggests. NEVER infer a unit's layout from its type name or from common usage; describe and offer units using ONLY these exact definitions:
${lines.join("\n")}
Critical: "غرفة فقط" (ONE_BEDROOM) is a single room with NO living room and NO kitchen — NEVER describe or offer it as "غرفة وصالة". If a customer asks for "غرفة وصالة" (a room WITH a separate living room), the smallest type that actually has a living room is the استوديو (Studio) — offer that instead, and be honest that "غرفة فقط" has no صالة.
</unit_types>`.trim();
}
