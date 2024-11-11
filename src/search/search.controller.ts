import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { RecentSearch } from './dto/recent-search.dto';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchSerivce: SearchService) {}
  @Get()
  getSuggestions(@Query() query) {
    return this.searchSerivce.getSuggestions(query);
  }

  @UseGuards(JwtAuthGuard)
  @Put('recent')
  saveRecentSearch(
    @AuthUser() jwtUser: JwtUser,
    @Body() SaveRecentSearchInput: RecentSearch,
  ) {
    return this.searchSerivce.saveRecentSearch(jwtUser, SaveRecentSearchInput);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recent')
  findRecentSearches(@AuthUser() jwtUser: JwtUser) {
    return this.searchSerivce.findRecentSearches(jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Put('recent/delete')
  deleteRecentSearch(
    @AuthUser() jwtUser: JwtUser,
    @Body() deleteRecentSearchInput: RecentSearch,
  ) {
    return this.searchSerivce.deleteRecentSearch(
      jwtUser,
      deleteRecentSearchInput,
    );
  }
}
