  import { GroupData, SheetAvailability, SheetData, SheetEvent, SheetIdea, SheetMember } from "./data_interfaces";

  import { google } from 'googleapis';
  import path from 'path';

const db_api_url = process.env.DB_API_URL;
const test_db_api_url = process.env.TEST_DB_API_URL ? process.env.TEST_DB_API_URL : "";

function normalizeGroupCode(groupCode: string): string {
  return groupCode.trim().toUpperCase();
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

async function getSheetData(groupCode: string): Promise<GroupData | null> { // NOTDONE
  return null;
}
async function putSheetData(groupCode: string, data: SheetData) { // NOTDONE
  if ('name' in data && 'color' in data && 'timezone' in data) {
    return;
  }

  if ('member' in data && 'date' in data && 'maybeStatusCode' in data && 'availableStatusCode' in data) {
    return;
  }

  if ('suggestedBy' in data && 'votes' in data) {
    return;
  }

  if ('RSVPs' in data) {
    return;
  }

  throw new Error('Unsupported SheetData type for putSheetData.');

}
async function updateSheetData(groupCode: string, data: SheetData): Promise<void> { // NOTDONE
    return;
}
async function deleteSheetData(groupCode: string, uuid: string): Promise<void> { // NOTDONE
    return;
}

export {  getAllMembers,
          getAllAvailabilities,
          getAllIdeas,
          getAllEvents,
          putSheetData, 
          getSheetData, 
          updateSheetData, 
          deleteSheetData };
