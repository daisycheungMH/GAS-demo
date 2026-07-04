export interface SheetData {
  UUID: string;
}

export interface SheetMembers extends SheetData {
  name: string;
  color: string;
  timezone: string;
}

export interface SheetAvailability extends SheetData {
  member: string;
  date: string; // YYYY-MM-DD 
  maybeStatusCode: string; // interger -> hex color code 0xFFFFFF
  availableStatusCode: string; // interger -> hex color code 0xFFFFFF
}

export interface SheetIdea extends SheetData {
  id: string;
  title: string;
  suggestedBy: string; // name of sheet member
  datetime: string; // ISO or empty
  place: string;
  links: string;
  notes: string;
  votes: string[]; // List of member names
}

export interface SheetEvent extends SheetData {
  id: string;
  title: string;
  datetime: string;
  place: string;
  links: string;
  notes: string;
  RSVPs: Record<string, 'going' | 'maybe' | 'cant'>;
}

export interface GroupData {
  name: string;
  members: SheetMembers[];
  availability: SheetAvailability[];
  ideas: SheetIdea[];
  events: SheetEvent[];
}