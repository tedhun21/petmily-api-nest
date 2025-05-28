import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto } from './dto/find.search.dto';
import { FindLocationCountDto } from './dto/find.location-count.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchSerivce: SearchService) {}

  @Get()
  searchData(@Query() searchDto: SearchDto) {
    return this.searchSerivce.searchData(searchDto);
  }

  @Get('location-count')
  loctionByCount(@Query() findLocationCountDto: FindLocationCountDto) {
    return this.searchSerivce.locationByCount(findLocationCountDto);
  }

  @Get('analyze')
  analye(@Query('text') text: string) {
    return this.searchSerivce.analyzeText('locations', text);
  }
}
