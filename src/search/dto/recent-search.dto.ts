export enum SearchType {
  USER = 'User',
  LOCATION = 'Location',
}

export class RecentSearch {
  id: number;
  type: SearchType;
}
