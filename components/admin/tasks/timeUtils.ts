export function formatTimeAgo(totalMinutes: number, isEn: boolean): string {
  if (totalMinutes < 60) {
    return isEn ? `${totalMinutes} mins ago` : `منذ ${totalMinutes} د`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  
  if (hours < 24) {
    const minText = remainingMins > 0 ? (isEn ? ` and ${remainingMins} mins` : ` و ${remainingMins} د`) : "";
    return isEn ? `${hours} hours${minText} ago` : `منذ ${hours} س${minText}`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  const hourText = remainingHours > 0 ? (isEn ? ` and ${remainingHours} hours` : ` و ${remainingHours} س`) : "";
  return isEn ? `${days} days${hourText} ago` : `منذ ${days} يوم${hourText}`;
}

/** Formats a date/time in Oman time, e.g. "29 Sep, 14:30" — same on server and client. */
export function formatDateTimeOman(date: Date | string, isEn: boolean): string {
  return new Date(date).toLocaleString(isEn ? "en-GB" : "ar-EG", {
    timeZone: "Asia/Muscat",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
