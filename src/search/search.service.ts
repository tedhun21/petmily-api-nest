import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { RecentSearch } from './dto/recent-search.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SearchService {
  private locations: string[];

  constructor(private readonly usersService: UsersService) {
    // location.json 파일 경로
    const filePath = path.join(
      process.cwd(),
      process.env.NODE_ENV === 'dev' ? 'src' : 'dist',
      'search',
      'data',
      'locations.json',
    );

    this.locations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  async getLocations(query) {
    const { q, limit } = query;

    const filtedLocations = this.locations
      .filter((location) => location.includes(q))
      .slice(0, limit);

    return filtedLocations;
  }

  async saveRecentSearch(
    jwtUser: JwtUser,
    saveRecentSearchInput: RecentSearch,
  ) {
    const { id: userId } = jwtUser;

    const updatedUser = await this.usersService.saveRecentSearch(
      userId,
      saveRecentSearchInput,
    );

    return updatedUser;
  }

  async findRecentSearches(jwtUser: JwtUser) {
    const { id: userId } = jwtUser;

    const recentSearches = await this.usersService.findRecentSearches(userId);

    return recentSearches;
  }

  async deleteRecentSearch(
    jwtUser: JwtUser,
    deleteRecentSearchesInput: RecentSearch,
  ) {
    const { id: userId } = jwtUser;

    const recentSearches = await this.usersService.deleteRecentSearch(
      userId,
      deleteRecentSearchesInput,
    );

    return recentSearches;
  }
}
