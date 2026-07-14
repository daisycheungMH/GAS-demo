  import { GroupData, SheetAvailability, SheetData, SheetEvent, SheetIdea, SheetMember } from "./data_interfaces";

  import { google } from 'googleapis';
  import path from 'path';

const db_api_url = process.env.DB_API_URL;
const test_db_api_url = process.env.TEST_DB_API_URL ? process.env.TEST_DB_API_URL : "";

// CRUD functions straight to the end point
async function createMembers(members: SheetMember[]): Promise<boolean> {
  return false;
}
async function createAvailabilities(availabilities: SheetAvailability[]): Promise<boolean> {
  return false;
}
async function createIdeas(ideas: SheetIdea[]): Promise<boolean> {
  return false;
}
async function createEvents(events: SheetEvent[]): Promise<boolean> {
  return false;
}

async function readMembers(uuids: string[] = []): Promise<SheetMember[]> {
  return [];
}
async function readAvailabilities(uuids: string[] = []): Promise<SheetAvailability[]> {
  return [];
}
async function readIdeas(uuids: string[] = []): Promise<SheetIdea[]> {
  return [];
}
async function readEvents(uuids: string[] = []): Promise<SheetEvent[]> {
  return [];
}

async function updateMembers(members: SheetMember[]): Promise<boolean> {
  return false;
}
async function updateAvailabilities(availabilities: SheetAvailability[]): Promise<boolean> {
  return false;
}
async function updateIdeas(ideas: SheetIdea[]): Promise<boolean> {
  return false;
}
async function updateEvents(events: SheetEvent[]): Promise<boolean> {
  return false;
}

async function deleteMembers(uuids: string[]): Promise<boolean> {
  return false;
}
async function deleteAvailabilities(uuids: string[]): Promise<boolean> {
  return false;
}
async function deleteIdeas(uuids: string[]): Promise<boolean> {
  return false;
}
async function deleteEvents(uuids: string[]): Promise<boolean> {
  return false;
}


