// Returns the label to show for a building in the ADMIN side. Prefers the
// short internal name; falls back to the localized public website name.
// Safe in Server and Client Components.

export type BuildingLike = {
  shortName?: string | null;
  nameEn: string;
  nameAr: string;
} | null | undefined;

export function buildingLabel(b: BuildingLike, isEn: boolean): string {
  if (!b) return "—";
  const short = b.shortName?.trim();
  if (short) return short;
  return isEn ? b.nameEn : b.nameAr;
}
