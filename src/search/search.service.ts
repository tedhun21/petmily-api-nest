import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { SaveRecentSearchInput, SearchType } from './dto/save-recent.dto';
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
    saveRecentSearchInput: SaveRecentSearchInput,
  ) {
    const { id: userId } = jwtUser;
    const { id, type } = saveRecentSearchInput;

    const updatedUser = await this.usersService.updateRecentSearches(
      userId,
      { id },
      type,
      'add',
    );

    return updatedUser;
  }

  async findRecentSearches(jwtUser: JwtUser) {
    const { id: userId } = jwtUser;

    const recentSearches = await this.usersService.findRecentSearches(userId);

    return recentSearches;
  }
}
