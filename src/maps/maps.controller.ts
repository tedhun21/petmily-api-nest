import { Controller, Get, Query, Res } from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}
  @Get('geocode')
  getGeocod(@Query() query) {
    return this.mapsService.getGeocode(query);
  }

  @Get('static')
  getStaticMaps(@Query() query, @Res() res) {
    return this.mapsService.getStaticMaps(query, res);
  }
}
