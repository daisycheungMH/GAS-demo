import { GroupData, SheetAvailability, SheetData, SheetEvent, SheetIdea, SheetMember } from "./data_interfaces";

const { google } = require('googleapis');
const path = require('path');

// Initialize auth client with downloaded JSON key file
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'credentials.json'), 
});
const dbFolderId = process.env.DB_FOLDER_ID;
const rootSheetId = process.env.ROOT_SHEET_ID;


async function appendRow(spreadsheetId: string, sheetName: string, newDataArray: any[]) {
  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  await googleSheets.spreadsheets.values.append({
    auth,
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [newDataArray], // Example: ['John Doe', 'john@example.com', 'Active']
    },
  });
  console.log('Row inserted successfully!');
}
async function createSpreadsheet(sheetName: string): Promise<string> {
    const url = 'https://sheets.googleapis.com/v4/spreadsheets';
    const payload = {
      properties: {
        title: sheetName,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await auth.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create spreadsheet: ${errorText}`);
    }

    const result = await response.json();
    const spreadsheetId = result?.spreadsheetId;

    if (!spreadsheetId) {
      throw new Error('Spreadsheet creation succeeded but no spreadsheetId was returned.');
    }

    // If configured, try moving the sheet into the configured DB folder.
    if (dbFolderId) {
      const moveUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${encodeURIComponent(dbFolderId)}&removeParents=root`;
      const moveResponse = await fetch(moveUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${await auth.getAccessToken()}`,
        },
      });

      if (!moveResponse.ok) {
        const moveErrorText = await moveResponse.text();
        console.warn(`Failed to move spreadsheet into DB_FOLDER_ID folder: ${moveErrorText}`);
      }
    }

    return spreadsheetId;

}
async function deleteSpreadsheet(spreadsheetId: string): Promise<void> {
    const client = await auth.getClient();
    const googleDrive = google.drive({ version: 'v3', auth: client });

    try {
      await googleDrive.files.delete({
        fileId: spreadsheetId,
      });
    } catch (error: any) {
      const status = error?.code || error?.response?.status;
      if (status === 404) {
        return;
      }
      throw new Error(`Failed to delete spreadsheet ${spreadsheetId}: ${error?.message || 'Unknown error'}`);
    }
}

// Get Group Sheet Id Caching

const GROUP_ID_CACHE_TTL_MS = 5 * 60 * 1000;
const groupIdCache: Record<string, { sheetId: string; expiresAt: number }> = {};

function normalizeGroupCode(groupCode: string): string {
  return groupCode.trim().toUpperCase();
}

function getCachedGroupSheetId(normalizedGroupCode: string): string | null {
  const cached = groupIdCache[normalizedGroupCode];
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    delete groupIdCache[normalizedGroupCode];
    return null;
  }
  return cached.sheetId;
}

function setCachedGroupSheetId(normalizedGroupCode: string, sheetId: string): void {
  groupIdCache[normalizedGroupCode] = {
    sheetId,
    expiresAt: Date.now() + GROUP_ID_CACHE_TTL_MS,
  };
}

function invalidateCachedGroupSheetId(normalizedGroupCode: string): void {
  delete groupIdCache[normalizedGroupCode];
}

async function getGroupSheetId(groupCode: string): Promise<string> {
    // from root sheet id
    if (!rootSheetId) {
      throw new Error('ROOT_SHEET_ID is not set in environment variables.');
    }
    const normalizedGroupCode = normalizeGroupCode(groupCode);
    const cachedSheetId = getCachedGroupSheetId(normalizedGroupCode);
    if (cachedSheetId) {
      return cachedSheetId;
    }

    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });
    const response = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId: rootSheetId,
      range: 'Sheet1!A:C',
    });

    const rows = response.data.values;

    // Root schema: Code, Name, SheetId
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const codeCell = String(row[0] ?? '').trim().toUpperCase();
      const legacyCodeCell = String(row[1] ?? '').trim().toUpperCase();

      if (codeCell === normalizedGroupCode || legacyCodeCell === normalizedGroupCode) {
        const sheetIdCandidate = String(row[2] ?? row[3] ?? row[1] ?? '').trim();
        if (sheetIdCandidate) {
          setCachedGroupSheetId(normalizedGroupCode, sheetIdCandidate);
          return sheetIdCandidate;
        }
        throw new Error(`Group code "${groupCode}" matched a row but had no sheet ID.`);
      }
    }

    throw new Error(`No sheet ID found for group code "${groupCode}" in ROOT_SHEET_ID.`);
}

async function initializeSheetHeaders(spreadsheetId: string) {
    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });

    const expectedSheets = [
      {
        title: 'Members',
        headers: ['UUID', 'name', 'color', 'timezone'],
      },
      {
        title: 'Availability',
        headers: ['UUID', 'member', 'date', 'maybeStatusCode', 'availableStatusCode'],
      },
      {
        title: 'Ideas',
        headers: ['UUID', 'id', 'title', 'suggestedBy', 'datetime', 'place', 'links', 'notes', 'votes'],
      },
      {
        title: 'Events',
        headers: ['UUID', 'id', 'title', 'datetime', 'place', 'links', 'notes', 'RSVPs'],
      },
    ];

    const expectedTitles = new Set(expectedSheets.map((sheet) => sheet.title));

    // Ensure all required sheets exist.
    const beforeEnsure = await googleSheets.spreadsheets.get({
      auth,
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    });
    const existingBeforeEnsure = beforeEnsure.data.sheets ?? [];
    const existingTitles = new Set(
      existingBeforeEnsure
        .map((sheet: any) => sheet.properties?.title)
        .filter((title: string | undefined): title is string => Boolean(title))
    );

    const addMissingRequests = expectedSheets
      .filter((sheet) => !existingTitles.has(sheet.title))
      .map((sheet) => ({
        addSheet: {
          properties: {
            title: sheet.title,
            gridProperties: {
              columnCount: sheet.headers.length,
            },
          },
        },
      }));

    if (addMissingRequests.length > 0) {
      await googleSheets.spreadsheets.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
          requests: addMissingRequests,
        },
      });
    }

    // Re-read metadata, then keep only the 4 required tabs and enforce exact column counts.
    const metadata = await googleSheets.spreadsheets.get({
      auth,
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,gridProperties(columnCount)))',
    });
    const allSheets = metadata.data.sheets ?? [];
    const byTitle = new Map<string, any>();
    for (const sheet of allSheets) {
      const title = sheet.properties?.title;
      if (title) byTitle.set(title, sheet);
    }

    const structureRequests: any[] = [];

    for (const sheet of allSheets) {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (!title || typeof sheetId !== 'number') continue;

      if (!expectedTitles.has(title)) {
        structureRequests.push({
          deleteSheet: { sheetId },
        });
      }
    }

    for (const expected of expectedSheets) {
      const sheet = byTitle.get(expected.title);
      const sheetId = sheet?.properties?.sheetId;
      if (typeof sheetId !== 'number') continue;

      structureRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              columnCount: expected.headers.length,
            },
          },
          fields: 'gridProperties.columnCount',
        },
      });
    }

    if (structureRequests.length > 0) {
      await googleSheets.spreadsheets.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
          requests: structureRequests,
        },
      });
    }

    const rangesData = expectedSheets.map((sheet) => ({
      range: `${sheet.title}!A1`,
      values: [sheet.headers],
    }));

    await googleSheets.spreadsheets.values.batchUpdate({
      auth,
      spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: rangesData,
      },
    });
}

// Implement Exported functions

async function createGroupSpreadsheet(groupCode: string, groupName: string): Promise<string> {
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  const spreadsheetId = await createSpreadsheet(groupCode);
  await initializeSheetHeaders(spreadsheetId);

  // add row to root sheet: Code, Name, SheetId
  if (!rootSheetId) {
    throw new Error('ROOT_SHEET_ID is not set in environment variables.');
  }

  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  await googleSheets.spreadsheets.values.append({
    auth,
    spreadsheetId: rootSheetId,
    range: 'Sheet1!A:C',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[groupCode, groupName, spreadsheetId]],
    },
  });


  console.log(`Group spreadsheet created for ${groupCode} with ID: ${spreadsheetId}`);

  setCachedGroupSheetId(normalizedGroupCode, spreadsheetId);

  return spreadsheetId;

}
async function deleteGroupSpreadsheet(groupCode: string): Promise<void> {
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  const spreadsheetId = await getGroupSheetId(groupCode);
  await deleteSpreadsheet(spreadsheetId);

  // find the row in root sheet and delete it
  if (!rootSheetId) {
    throw new Error('ROOT_SHEET_ID is not set in environment variables.');
  }

  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  const [metaResponse, valuesResponse] = await Promise.all([
    googleSheets.spreadsheets.get({
      auth,
      spreadsheetId: rootSheetId,
      fields: 'sheets(properties(sheetId,title))',
    }),
    googleSheets.spreadsheets.values.get({
      auth,
      spreadsheetId: rootSheetId,
      range: 'Sheet1!A:C',
    }),
  ]);

  const rows = valuesResponse.data.values ?? [];

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const codeCell = String(row[0] ?? '').trim().toUpperCase();
    const nameCell = String(row[1] ?? '').trim().toUpperCase();
    if (codeCell === normalizedGroupCode || nameCell === normalizedGroupCode) {
      targetRowIndex = i;
      break;
    }
  }

  if (targetRowIndex < 0) {
    invalidateCachedGroupSheetId(normalizedGroupCode);
    return;
  }

  const rootSheets = metaResponse.data.sheets ?? [];
  const rootSheetInternalId = rootSheets[0]?.properties?.sheetId;

  await googleSheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId: rootSheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: rootSheetInternalId,
              dimension: 'ROWS',
              startIndex: targetRowIndex,
              endIndex: targetRowIndex + 1,
            },
          },
        },
      ],
    },
  });

  invalidateCachedGroupSheetId(normalizedGroupCode);

}

// Convient Gets
async function getAllCodes(): Promise<Array<string>> {
  if (!rootSheetId) {
    throw new Error('ROOT_SHEET_ID is not set in environment variables.');
  }

  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });
  const response = await googleSheets.spreadsheets.values.get({
      auth,
      spreadsheetId: rootSheetId,
    range: 'Sheet1!A:C',
  });

  const rows = response.data.values ?? [];
  const returnList: Array<string> = [];

  // Root schema: Code, Name, SheetId
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const codeCell = String(row[0] ?? '').trim().toUpperCase();
    const sheetIdCandidate = String(row[2] ?? row[3] ?? row[1] ?? '').trim();
    if (codeCell) {
      setCachedGroupSheetId(codeCell, sheetIdCandidate);
      returnList.push(codeCell);
    }
  }

  return returnList;
}

const groupSheetCache: Record<string, GroupData> = {}; // group code : GroupSheetData

function getGroupSheetCache(groupCode: string): GroupData | null {
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  return groupSheetCache[normalizedGroupCode] || null;
}
function setGroupSheetCache(groupCode: string, data: GroupData): void {
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  groupSheetCache[normalizedGroupCode] = data;
}
function invalidateGroupSheetCache(groupCode: string): void {
  const normalizedGroupCode = normalizeGroupCode(groupCode);
  delete groupSheetCache[normalizedGroupCode];
}

async function getAllMembers(groupCode: string): Promise<SheetMember[]> {
  const groupData = await getSheetData(groupCode);
  return groupData ? groupData.members : [];
}
async function getAllAvailabilities(groupCode: string): Promise<SheetAvailability[]> {
  const groupData = await getSheetData(groupCode);
  return groupData ? groupData.availability : [];
}
async function getAllIdeas(groupCode: string): Promise<SheetIdea[]> {
  const groupData = await getSheetData(groupCode);
  return groupData ? groupData.ideas : [];
}
async function getAllEvents(groupCode: string): Promise<SheetEvent[]> {
  const groupData = await getSheetData(groupCode);
  return groupData ? groupData.events : [];
}


// all the standard CRUD operations for each of the data types

async function getSheetData(groupCode: string): Promise<GroupData | null> {
  const cachedData = getGroupSheetCache(groupCode);
  if (cachedData) {
    return cachedData;
  }

  const spreadsheetId = await getGroupSheetId(groupCode);
  const client = await auth.getClient();
  const googleSheets = google.sheets({ version: 'v4', auth: client });

  try {
    const [metaResponse, valuesResponse] = await Promise.all([
      googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
        fields: 'properties(title)',
      }),
      googleSheets.spreadsheets.values.batchGet({
        auth,
        spreadsheetId,
        ranges: ['Members!A:Z', 'Availability!A:Z', 'Ideas!A:Z', 'Events!A:Z'],
      }),
    ]);

    const groupName = metaResponse.data.properties?.title ?? '';
    const valueRanges = valuesResponse.data.valueRanges ?? [];

    const memberRows = valueRanges[0]?.values ?? [];
    const availabilityRows = valueRanges[1]?.values ?? [];
    const ideaRows = valueRanges[2]?.values ?? [];
    const eventRows = valueRanges[3]?.values ?? [];

    const members = memberRows.slice(1).map((row: any[]) => ({
      UUID: String(row[0] ?? ''),
      name: String(row[1] ?? ''),
      color: String(row[2] ?? ''),
      timezone: String(row[3] ?? ''),
    })).filter((row: any) => row.UUID || row.name);

    const availability = availabilityRows.slice(1).map((row: any[]) => ({
      UUID: String(row[0] ?? ''),
      member: String(row[1] ?? ''),
      date: String(row[2] ?? ''),
      maybeStatusCode: String(row[3] ?? ''),
      availableStatusCode: String(row[4] ?? ''),
    })).filter((row: any) => row.UUID || row.member || row.date);

    const ideas = ideaRows.slice(1).map((row: any[]) => ({
      UUID: String(row[0] ?? ''),
      id: String(row[1] ?? ''),
      title: String(row[2] ?? ''),
      suggestedBy: String(row[3] ?? ''),
      datetime: String(row[4] ?? ''),
      place: String(row[5] ?? ''),
      links: String(row[6] ?? ''),
      notes: String(row[7] ?? ''),
      votes: String(row[8] ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    })).filter((row: any) => row.UUID || row.id || row.title);

    const events = eventRows.slice(1).map((row: any[]) => {
      let rsvps: Record<string, 'going' | 'maybe' | 'cant'> = {};
      try {
        rsvps = row[7] ? JSON.parse(String(row[7])) : {};
      } catch {
        rsvps = {};
      }

      return {
        UUID: String(row[0] ?? ''),
        id: String(row[1] ?? ''),
        title: String(row[2] ?? ''),
        datetime: String(row[3] ?? ''),
        place: String(row[4] ?? ''),
        links: String(row[5] ?? ''),
        notes: String(row[6] ?? ''),
        RSVPs: rsvps,
      };
    }).filter((row: any) => row.UUID || row.id || row.title);

    const groupData = {
      name: groupName,
      members,
      availability,
      ideas,
      events,
    };
    setGroupSheetCache(groupCode, groupData);
    return groupData;
  } catch (error: any) {
    const status = error?.code || error?.response?.status;
    if (status === 404) {
      return null;
    }
    throw new Error(`Failed to get sheet data for ${spreadsheetId}: ${error?.message || 'Unknown error'}`);
  }
}
async function putSheetData(groupCode: string, data: SheetData) {
  invalidateGroupSheetCache(groupCode);
  const spreadsheetId = await getGroupSheetId(groupCode);
  if ('name' in data && 'color' in data && 'timezone' in data) {
    const member = data as SheetMember;
    await appendRow(spreadsheetId, 'Members', [member.UUID, member.name, member.color, member.timezone]);
    return;
  }

  if ('member' in data && 'date' in data && 'maybeStatusCode' in data && 'availableStatusCode' in data) {
    const availability = data as SheetAvailability;
    await appendRow(spreadsheetId, 'Availability', [availability.UUID, availability.member, availability.date, availability.maybeStatusCode, availability.availableStatusCode]);
    return;
  }

  if ('suggestedBy' in data && 'votes' in data) {
    const idea = data as any;
    await appendRow(spreadsheetId, 'Ideas', [idea.UUID, idea.id, idea.title, idea.suggestedBy, idea.datetime, idea.place, idea.links, idea.notes, Array.isArray(idea.votes) ? idea.votes.join(',') : '']);
    return;
  }

  if ('RSVPs' in data) {
    const event = data as any;
    await appendRow(spreadsheetId, 'Events', [event.UUID, event.id, event.title, event.datetime, event.place, event.links, event.notes, JSON.stringify(event.RSVPs ?? {})]);
    return;
  }

  throw new Error('Unsupported SheetData type for putSheetData.');

}
async function updateSheetData(groupCode: string, data: SheetData): Promise<void> {
    invalidateGroupSheetCache(groupCode);
    const spreadsheetId = await getGroupSheetId(groupCode);
    await deleteSheetData(spreadsheetId, data.UUID);
    await putSheetData(spreadsheetId, data);
}
async function deleteSheetData(groupCode: string, uuid: string): Promise<void> {
    invalidateGroupSheetCache(groupCode);
    const spreadsheetId = await getGroupSheetId(groupCode);
    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });

    const targetUuid = uuid.trim();
    if (!targetUuid) {
      throw new Error('UUID is required to delete sheet data.');
    }

    const targetSheets = ['Members', 'Availability', 'Ideas', 'Events'];

    const [metaResponse, valuesResponse] = await Promise.all([
      googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title))',
      }),
      googleSheets.spreadsheets.values.batchGet({
        auth,
        spreadsheetId,
        ranges: targetSheets.map((sheetName) => `${sheetName}!A:A`),
      }),
    ]);

    const allSheets = metaResponse.data.sheets ?? [];
    const sheetIdByTitle = new Map<string, number>();
    for (const sheet of allSheets) {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (title && typeof sheetId === 'number') {
        sheetIdByTitle.set(title, sheetId);
      }
    }

    const valueRanges = valuesResponse.data.valueRanges ?? [];
    for (let i = 0; i < targetSheets.length; i++) {
      const sheetName = targetSheets[i];
      const rows = valueRanges[i]?.values ?? [];

      // Skip header row (row 1), search data rows from row 2 onward.
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const rowUuid = String(rows[rowIndex]?.[0] ?? '').trim();
        if (rowUuid !== targetUuid) continue;

        const targetSheetId = sheetIdByTitle.get(sheetName);
        if (typeof targetSheetId !== 'number') {
          throw new Error(`Sheet "${sheetName}" does not exist in spreadsheet ${spreadsheetId}.`);
        }

        await googleSheets.spreadsheets.batchUpdate({
          auth,
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: targetSheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1,
                  },
                },
              },
            ],
          },
        });

        return;
      }
    }

    throw new Error(`No row found for UUID "${targetUuid}" in spreadsheet ${spreadsheetId}.`);
}

export { createGroupSpreadsheet, 
          deleteGroupSpreadsheet,  
          getAllCodes,
          getAllMembers,
          getAllAvailabilities,
          getAllIdeas,
          getAllEvents,
          putSheetData, 
          getSheetData, 
          updateSheetData, 
          deleteSheetData };
