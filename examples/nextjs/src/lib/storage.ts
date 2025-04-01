import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), '.visitor-storage.json');

// Initialize storage file if it doesn't exist
if (!fs.existsSync(STORAGE_FILE)) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify({ visitorId: null }));
}

export function getVisitorId(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    return data.visitorId;
  } catch (error) {
    console.error('Error reading visitor ID:', error);
    return null;
  }
}

export function setVisitorId(id: string): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ visitorId: id }));
  } catch (error) {
    console.error('Error writing visitor ID:', error);
  }
}
