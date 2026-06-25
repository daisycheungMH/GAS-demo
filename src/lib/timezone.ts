/**
 * Timezone helpers
 */

/**
 * Returns a list of common timezones for easy selection
 */
export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Adak",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

/**
 * Gets the user's browser timezone, or America/New_York as fallback
 */
export function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York";
  }
}

/**
 * Formats an ISO datetime string into a readable format in a specific timezone
 */
export function formatInTimezone(isoString: string, timeZone: string, formatStyle: 'full' | 'time' | 'date' = 'full'): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {};
    
    if (formatStyle === 'full') {
      options.dateStyle = 'medium';
      options.timeStyle = 'short';
    } else if (formatStyle === 'time') {
      options.timeStyle = 'short';
    } else {
      options.dateStyle = 'medium';
    }
    
    options.timeZone = timeZone;
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch (e) {
    console.error("Format timezone error", e);
    return isoString;
  }
}

/**
 * Converts a slot index (0 to 47 for 30-min slots starting at 00:00) to a readable string (HH:MM)
 */
export function indexToTimeStr(index: number): string {
  const hour = Math.floor(index / 2);
  const min = (index % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

/**
 * Converts a readable time string (HH:MM) to a slot index (0 to 47)
 */
export function timeStrToPercent(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h * 60 + m) / 1440 * 100;
}
