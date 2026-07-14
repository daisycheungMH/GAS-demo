/**
 * Google Sheets API Integration
 */

export interface SheetMembers {
  name: string;
  color: string;
  timezone: string;
}

export interface SheetAvailability {
  member: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string;   // HH:MM
  status: 'available' | 'maybe' | 'unavailable';
}

export interface SheetIdea {
  id: string;
  title: string;
  suggestedBy: string;
  datetime: string; // ISO or empty
  place: string;
  links: string;
  notes: string;
  votes: string[]; // List of member names
}

export interface SheetEvent {
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

/**
 * Creates a new Google Sheet for the group with pre-configured tabs and headers
 */
export async function createSpreadsheet(accessToken: string, groupName: string): Promise<string> {
  const url = "https://sheets.googleapis.com/v4/spreadsheets";
  const body = {
    properties: {
      title: `meetLesbians - ${groupName}`,
    },
    sheets: [
      { properties: { title: "Members" } },
      { properties: { title: "Availability" } },
      { properties: { title: "Ideas" } },
      { properties: { title: "Events" } },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create spreadsheet: ${errorText}`);
  }

  const result = await response.json();
  const spreadsheetId = result.spreadsheetId;

  // Initialize headers for each tab
  await initializeSheetHeaders(accessToken, spreadsheetId);

  return spreadsheetId;
}

/**
 * Initializes the header row for each tab
 */
async function initializeSheetHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const rangesData = [
    {
      range: "Members!A1:C1",
      values: [["name", "color", "timezone"]],
    },
    {
      range: "Availability!A1:E1",
      values: [["member", "date", "start", "end", "status"]],
    },
    {
      range: "Ideas!A1:H1",
      values: [["id", "title", "suggested_by", "datetime", "place", "links", "notes", "votes"]],
    },
    {
      range: "Events!A1:G1",
      values: [["id", "title", "datetime", "place", "links", "notes", "RSVPs"]],
    },
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const body = {
    valueInputOption: "USER_ENTERED",
    data: rangesData.map((r) => ({
      range: r.range,
      values: r.values,
    })),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initialize headers: ${errorText}`);
  }
}

/**
 * Writes complete group data to the Google Sheet (overwrites existing rows)
 */
export async function syncGroupToSheet(
  accessToken: string,
  sheetId: string,
  group: GroupData
): Promise<void> {
  // 1. Prepare Members values
  const memberValues = [
    ["name", "color", "timezone"],
    ...group.members.map((m) => [m.name, m.color, m.timezone]),
  ];

  // 2. Prepare Availability values
  const availabilityValues = [
    ["member", "date", "start", "end", "status"],
    ...group.availability.map((a) => [a.member, a.date, a.start, a.end, a.status]),
  ];

  // 3. Prepare Ideas values
  const ideaValues = [
    ["id", "title", "suggested_by", "datetime", "place", "links", "notes", "votes"],
    ...group.ideas.map((i) => [
      i.id,
      i.title,
      i.suggestedBy,
      i.datetime || "",
      i.place || "",
      i.links || "",
      i.notes || "",
      i.votes.join(","), // Comma-separated voters
    ]),
  ];

  // 4. Prepare Events values
  const eventValues = [
    ["id", "title", "datetime", "place", "links", "notes", "RSVPs"],
    ...group.events.map((e) => [
      e.id,
      e.title,
      e.datetime,
      e.place || "",
      e.links || "",
      e.notes || "",
      JSON.stringify(e.RSVPs), // Store RSVPs as JSON string
    ]),
  ];

  // Clear existing rows and write fresh ones
  const clearRanges = ["Members!A1:Z1000", "Availability!A1:Z5000", "Ideas!A1:Z1000", "Events!A1:Z1000"];
  
  // Clear sheets first
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchClear`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ranges: clearRanges }),
  });

  // Write values
  const writeBody = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: "Members!A1", values: memberValues },
      { range: "Availability!A1", values: availabilityValues },
      { range: "Ideas!A1", values: ideaValues },
      { range: "Events!A1", values: eventValues },
    ],
  };

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(writeBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to sync to Google Sheet: ${errorText}`);
  }
}

/**
 * Reads group data from the Google Sheet
 */
export async function syncGroupFromSheet(accessToken: string, sheetId: string): Promise<Partial<GroupData>> {
  const ranges = ["Members!A1:C1000", "Availability!A1:E5000", "Ideas!A1:H1000", "Events!A1:G1000"];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=${ranges.map(encodeURIComponent).join("&")}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch from Google Sheet: ${errorText}`);
  }

  const result = await response.json();
  const valueRanges = result.valueRanges || [];

  const members: SheetMembers[] = [];
  const availability: SheetAvailability[] = [];
  const ideas: SheetIdea[] = [];
  const events: SheetEvent[] = [];

  // Parse Members
  const memberRows = valueRanges[0]?.values || [];
  if (memberRows.length > 1) {
    for (let i = 1; i < memberRows.length; i++) {
      const row = memberRows[i];
      if (row[0]) {
        members.push({
          name: row[0],
          color: row[1] || "#2DD4BF",
          timezone: row[2] || Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
    }
  }

  // Parse Availability
  const availabilityRows = valueRanges[1]?.values || [];
  if (availabilityRows.length > 1) {
    for (let i = 1; i < availabilityRows.length; i++) {
      const row = availabilityRows[i];
      if (row[0] && row[1]) {
        availability.push({
          member: row[0],
          date: row[1],
          start: row[2] || "09:00",
          end: row[3] || "17:00",
          status: (row[4] as any) || "available",
        });
      }
    }
  }

  // Parse Ideas
  const ideaRows = valueRanges[2]?.values || [];
  if (ideaRows.length > 1) {
    for (let i = 1; i < ideaRows.length; i++) {
      const row = ideaRows[i];
      if (row[0] && row[1]) {
        ideas.push({
          id: row[0],
          title: row[1],
          suggestedBy: row[2] || "Anonymous",
          datetime: row[3] || "",
          place: row[4] || "",
          links: row[5] || "",
          notes: row[6] || "",
          votes: row[7] ? row[7].split(",").filter(Boolean) : [],
        });
      }
    }
  }

  // Parse Events
  const eventRows = valueRanges[3]?.values || [];
  if (eventRows.length > 1) {
    for (let i = 1; i < eventRows.length; i++) {
      const row = eventRows[i];
      if (row[0] && row[1]) {
        let rsvps: Record<string, any> = {};
        try {
          rsvps = row[6] ? JSON.parse(row[6]) : {};
        } catch {
          rsvps = {};
        }
        events.push({
          id: row[0],
          title: row[1],
          datetime: row[2] || "",
          place: row[3] || "",
          links: row[4] || "",
          notes: row[5] || "",
          RSVPs: rsvps,
        });
      }
    }
  }

  return { members, availability, ideas, events };
}
