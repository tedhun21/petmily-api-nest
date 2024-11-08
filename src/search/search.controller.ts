import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SaveRecentSearchInput } from './dto/save-recent.dto';
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
  @Post('recent')
  saveRecentSearch(
    @AuthUser() jwtUser: JwtUser,
    @Body() SaveRecentSearchInput: SaveRecentSearchInput,
  ) {
    return this.searchSerivce.saveRecentSearch(jwtUser, SaveRecentSearchInput);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recent')
  findRecentSearches(@AuthUser() jwtUser: JwtUser) {
    return this.searchSerivce.findRecentSearches(jwtUser);
  }
}
