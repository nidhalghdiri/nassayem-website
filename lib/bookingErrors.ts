// Thrown by calculateBookingPrice when a stay overlaps July/August and no
// active promotion covers the dates. Lives in /lib (not /app/actions) because
// "use server" modules may only export async functions.
export const KHAREEF_NO_PROMO_ERROR = "KHAREEF_NO_PROMO";
