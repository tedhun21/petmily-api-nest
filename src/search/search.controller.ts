import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchSerivce: SearchService) {}

  @Get()
  searchData(
    @Query('index') index: string,
    @Query('query') query: string,
    @Query('size') size?: string,
  ) {
    return this.searchSerivce.searchData(index, query, size);
  }

  @Get('location-count')
  loctionByCount(@Query('size') size: string) {
    return this.searchSerivce.locationByCount(size);
  }
}
