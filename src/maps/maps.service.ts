import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom, lastValueFrom } from 'rxjs';

@Injectable()
export class MapsService {
  private readonly headers = null;
  private readonly NaverAPI = 'https://naveropenapi.apigw.ntruss.com';
  constructor(private readonly httpService: HttpService) {
    this.headers = {
      'X-NCP-APIGW-API-KEY-ID': `${process.env.NAVER_MAPS_CLIENT_ID}`,
      'X-NCP-APIGW-API-KEY': `${process.env.NAVER_MAPS_CLIENT_SECRET}`,
    };
  }
  async getGeocode(query) {
    const { location } = query;
    const NaverMapsGeoUrl = '/map-geocode/v2/geocode';

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.NaverAPI}${NaverMapsGeoUrl}?query=${location}`,
          {
            headers: this.headers,
          },
        ),
      );

      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async getStaticMaps(query, res) {
    const { latitude, longitude } = query;

    const NaverMapsStaticUrl = '/map-static/v2/raster';

    const markers = `type:n|size:tiny|color:0x029DFF|pos:${longitude}%20${latitude}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.NaverAPI}${NaverMapsStaticUrl}?w=500&h=200&center=${longitude},${latitude}&level=16&markers=${markers}`,
          { headers: this.headers, responseType: 'arraybuffer' }, // responseType을 arraybuffer로 설정
        ),
      );

      // Check if response data is valid
      if (response && response.data) {
        // Content-Type과 Content-Length 설정
        res.set('Content-Type', 'image/jpg,jpeg');
        res.set('Content-Length', response.data.byteLength.toString());

        // Send the binary image data
        res.send(Buffer.from(response.data)); // Buffer로 변환하여 전송
      } else {
        res.status(404).send('Image not found.');
      }
    } catch (e) {
      console.error(e);
      res.status(500).send('Error retrieving the static map image.');
    }
  }
}
