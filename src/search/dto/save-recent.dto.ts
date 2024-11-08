export enum SearchType {
  USER = 'User',
  LOCATION = 'Location',
}

export class SaveRecentSearchInput {
  id: number;
  type: SearchType;
}
