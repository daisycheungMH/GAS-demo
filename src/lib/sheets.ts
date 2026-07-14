  import { GroupData, SheetAvailability, SheetData, SheetEvent, SheetIdea, SheetMember } from "./data_interfaces";

  import { google } from 'googleapis';
  import path from 'path';

const db_api_url = process.env.DB_API_URL;
const test_db_api_url = process.env.TEST_DB_API_URL ? process.env.TEST_DB_API_URL : "";

// CRUD functions straight to the end point
export async function createMembers(members: SheetMember[]): Promise<boolean> {
  return false;
}
export async function createAvailabilities(availabilities: SheetAvailability[]): Promise<boolean> {
  return false;
}
export async function createIdeas(ideas: SheetIdea[]): Promise<boolean> {
  return false;
}
export async function createEvents(events: SheetEvent[]): Promise<boolean> {
  return false;
}

export async function readMembers(uuids: string[] = []): Promise<SheetMember[]> {
  return [];
}
export async function readAvailabilities(uuids: string[] = []): Promise<SheetAvailability[]> {
  return [];
}
export async function readIdeas(uuids: string[] = []): Promise<SheetIdea[]> {
  return [];
}
export async function readEvents(uuids: string[] = []): Promise<SheetEvent[]> {
  return [];
}

export async function updateMembers(members: SheetMember[]): Promise<boolean> {
  return false;
}
export async function updateAvailabilities(availabilities: SheetAvailability[]): Promise<boolean> {
  return false;
}
export async function updateIdeas(ideas: SheetIdea[]): Promise<boolean> {
  return false;
}
export async function updateEvents(events: SheetEvent[]): Promise<boolean> {
  return false;
}

export async function deleteMembers(uuids: string[]): Promise<boolean> {
  return false;
}
export async function deleteAvailabilities(uuids: string[]): Promise<boolean> {
  return false;
}
export async function deleteIdeas(uuids: string[]): Promise<boolean> {
  return false;
}
export async function deleteEvents(uuids: string[]): Promise<boolean> {
  return false;
}

// higher level
export async function pushAvailabilities(availabilities: SheetAvailability[]): Promise<boolean> {
  return createAvailabilities(availabilities); // NOT DONOE
}

