/**
 * Single source of truth for public-facing contact details.
 *
 * These values were previously duplicated across the homepage, the contact
 * page, the buildings page and the checkout success page, and had drifted out
 * of sync (two different emails, and a placeholder "+968 1234 5678" phone).
 * Google Ads landing pages are checked for consistent, working contact info,
 * so every public surface must read from here.
 */

/** Display form, with spaces. */
export const CONTACT_PHONE_DISPLAY = "+968 99551237";

/** E.164, for tel: hrefs. */
export const CONTACT_PHONE_E164 = "+96899551237";

/** Digits only, no "+" — the form wa.me expects. */
export const CONTACT_WHATSAPP = "96899551237";

export const CONTACT_EMAIL = "info@nassayemsalalah.com";

export const CONTACT_ADDRESS_EN = "Al Luban Street, Salalah, Dhofar Governorate, Sultanate of Oman";
export const CONTACT_ADDRESS_AR = "شارع اللبان، صلالة، محافظة ظفار، سلطنة عمان";

/**
 * Opens Google Maps searching for the office address. This is a search URL
 * rather than a dropped pin because we don't have a verified coordinate for
 * the office itself — the coordinates in MapComponent are building locations.
 * Replace with a share link from the real Google Business Profile when
 * available; the rest of the site will pick it up automatically.
 */
export const CONTACT_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "Nassayem Salalah, Al Luban Street, Salalah, Oman",
)}`;

/**
 * Social profiles. Anything left null is not rendered at all — an href="#"
 * that goes nowhere counts against landing page quality, so a missing profile
 * must be absent rather than dead. Fill in when the real URLs are confirmed.
 */
export const SOCIAL_LINKS: {
  instagram: string | null;
  linkedin: string | null;
} = {
  instagram: null,
  linkedin: null,
};

/** Prefilled wa.me link. Used by every WhatsApp entry point on the site. */
export function whatsappLink(message: string): string {
  return `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
