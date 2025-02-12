import * as path from 'path';
import * as fs from 'fs';

// 파일 경로
const locationsFilePath = path.join(
  process.cwd(),
  process.env.NODE_ENV === 'dev' ? 'src' : 'dist',
  'common',
  'location',
  'locations.json',
);

export function getLocations() {
  return JSON.parse(fs.readFileSync(locationsFilePath, 'utf-8'));
}

export function isValidLocation(location: string): boolean {
  const locations = getLocations();

  const keys = locations?.map((location) => location.district);

  return keys.includes(location);
}
