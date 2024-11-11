import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { RecentSearch, SearchType } from './dto/recent-search.dto';
import { JwtUser } from 'src/auth/decorater/auth.decorator';

@Injectable()
export class SearchService {
  constructor(private readonly usersService: UsersService) {}

  async getSuggestions(query) {
    const { q, page, pageSize } = query;

    const { results: nicknameResults } =
      await this.usersService.findPetsittersByNickname(q, {
        page: String(page),
        pageSize: String(pageSize),
      });

    // const { results: locationResults } =
    //   await this.usersService.findPetsittersByLocation(q, {
    //     page: String(page),
    //     pageSize: String(pageSize),
    //   });

    const combinedResults = [...nicknameResults];
    return { results: combinedResults, pagination: {} };
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
