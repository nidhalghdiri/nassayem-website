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
