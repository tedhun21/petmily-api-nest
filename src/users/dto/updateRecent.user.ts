export enum SearchType {
  USER = 'User',
  LOCATION = 'Location',
}

export class RecentSearchInput {
  id?: number;
  name: string;
  type: SearchType;
}
