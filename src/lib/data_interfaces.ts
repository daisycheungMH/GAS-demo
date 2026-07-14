export interface SheetData {
  UUID: string;
}

export interface SheetMember extends SheetData {
  name: string;
  color: string;
  timezone: string;
}

export interface SheetAvailability extends SheetData {
  member: string;
  date: string; // YYYY-MM-DD 
  statusCode: string; // interger -> hex color code 0xFFFFFF
}

export interface SheetIdea extends SheetData {
  title: string;
  suggestedBy: string; // name of sheet member
  datetime: string; // ISO or empty
  place: string;
  links: string;
  notes: string;
  votes: string[]; // List of member names
}

export interface SheetEvent extends SheetData {
  title: string;
  datetime: string;
  place: string;
  links: string;
  notes: string;
  rsvps: Record<string, 'going' | 'maybe' | 'cant'>;
}

export interface GroupData {
  name: string;
  members: SheetMember[];
  availability: SheetAvailability[];
  ideas: SheetIdea[];
  events: SheetEvent[];
}

const D = Object.freeze({
    Unavailable: 0,
    Maybe: 1,
    Available: 2
});

export function availabilityBlockstoStatusCode(blocks: number[]): string {
  if (blocks.length !== 24) {
    throw new Error("Blocks array must have 24 elements");
  }

  let statusCode = 0;
  for (let i = 0; i < 6; i++) {
    const blockValue = blocks[i * 4] << 0 | blocks[i * 4 + 1] << 1 | blocks[i * 4 + 2] << 2 | blocks[i * 4 + 3] << 3;
    statusCode |= (blockValue << (i * 4));
  }
  return statusCode.toString(16);
}

export function statusCodetoAvailabilityBlocks(statusCode: string): number[] {
  const blocks: number[] = new Array(24).fill(0);
  const code = parseInt(statusCode, 16);
  for (let i = 0; i < 6; i++) {
    const blockValue = (code >> (i * 4)) & 0xF;
    blocks[i * 4] = (blockValue >> 0) & 1;
    blocks[i * 4 + 1] = (blockValue >> 1) & 1;
    blocks[i * 4 + 2] = (blockValue >> 2) & 1;
    blocks[i * 4 + 3] = (blockValue >> 3) & 1;
  }
  return blocks;
}