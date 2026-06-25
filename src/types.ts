export type AvailabilityStatus = 'available' | 'maybe' | 'unavailable';

export interface Member {
  name: string;
  color: string;
  timezone: string;
}

export interface AvailabilityBlock {
  member: string; // Member name (unique within group)
  date: string;   // Either a specific date "YYYY-MM-DD" or a day name for recurring: "Monday", "Tuesday", etc.
  start: string;  // "HH:MM" 24h format
  end: string;    // "HH:MM" 24h format
  status: AvailabilityStatus;
  isRecurring: boolean; // e.g. "Every Tuesday"
}

export interface IdeaAttachment {
  id: string;
  type: 'link' | 'photo';
  url: string;
  name: string;
  addedBy: string;
}

export interface Idea {
  id: string;
  title: string;
  suggestedBy: string;
  datetime?: string; // Optional proposed date-time "YYYY-MM-DDTHH:MM"
  place?: string;    // Place or URL
  links?: string;    // Links (URL)
  notes?: string;    // Free text
  votes: string[];   // Array of member names who voted "I'm in"
  signups?: string[]; // Array of member names who signed up
  attachments?: IdeaAttachment[];
}

export interface Event {
  id: string;
  title: string;
  datetime: string; // Confirmed date-time "YYYY-MM-DDTHH:MM"
  place: string;
  links: string;
  notes: string;
  RSVPs: Record<string, 'going' | 'maybe' | 'cant'>; // memberName -> response
}

export interface Group {
  groupId: string;
  name: string;
  sheetId: string;
  sheetOwnerUid?: string;
  createdAt: string;
  members: Member[];
  availability: AvailabilityBlock[];
  ideas: Idea[];
  events: Event[];
}

export const PRESET_COLORS = [
  "#2DD4BF", // Teal
  "#A855F7", // Lavender
  "#EC4899", // Dusty Rose
  "#F59E0B", // Muted Amber
  "#3B82F6", // Soft Blue
  "#10B981", // Emerald Green
  "#EF4444", // Soft Red
  "#6366F1", // Indigo
  "#14B8A6", // Cyan
  "#F43F5E", // Rose
];
