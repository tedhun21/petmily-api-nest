import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ElasticsearchService } from '@nestjs/elasticsearch';
import { getLocations } from 'src/common/location/location.utils';
import { SearchDto } from './dto/find.search.dto';
import { FindLocationCountDto } from './dto/find.location-count.dto';
import { RedisLocationService } from 'src/redis/location/redis-location.service';
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly redisLocationService: RedisLocationService,
  ) {}

  async onModuleInit() {
    try {
      await this.elasticsearchService.ping();
      this.logger.log('ELASTICSEARCH: ✅ Elasticsearch is connected');

      await this.createIndex('locations');
      await this.seedLocations();
    } catch (error) {
      this.logger.error(
        'ELASTICSEARCH: ❌ Elasticsearch connection failed:',
        error,
      );
    }
  }

  // 초기값
  async seedLocations() {
    const districts = getLocations();

    // bulk로 한번에 넣기
    const bulkOperations = [];

    districts.forEach(({ district }) => {
      bulkOperations.push(
        { index: { _index: 'locations', _id: district } }, // 인덱스 및 ID 설정
        { district }, // _source에 들어갈 데이터
      );
    });

    try {
      // bulk API 데이터 인덱싱
      const response = await this.elasticsearchService.bulk({
        body: bulkOperations,
      });

      return response;
    } catch (e) {
      console.error('Error in bulk indexing:', e);
      throw e;
    }
  }

  // elastic - 인덱싱
  async createIndex(indexName: string) {
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: indexName,
      });

      if (!indexExists) {
        await this.elasticsearchService.indices.create({
          index: indexName,
          body: {
            settings: {
              // 분석기(Tokenizer, Filter) 정의
              analysis: {
                tokenizer: {
                  // 토큰화 도구: 텍스트를 단어/형태소 단위로 분해
                  nori_tokenizer: {
                    type: 'nori_tokenizer', // 한국어 형태소 분석 // "셔울 용산구" -> ["서울", "용산"] - "구"는 의미없는 조사로 판단하여 제거
                  },
                },
                filter: {
                  // 나눈 단어를 더 가공하는 도구 (토큰 후처리)
                  ngram_filter: {
                    // 단어를 중간에서 자르는 n-gram 필터 (부분 일치 검색용)
                    // "용산"
                    // 2자 조합 (min_gram) ["용산"]
                    // 3자 조합 (max_gram) []
                    type: 'ngram',
                    min_gram: 2,
                    max_gram: 3,
                  },
                  edge_ngram_filter: {
                    // 단어의 앞부분만 자르는 edge n-gram (자동완성용)
                    // "용산"
                    // ["용", "용산"]
                    type: 'edge_ngram',
                    min_gram: 1,
                    max_gram: 5,
                  },
                },
                analyzer: {
                  nori_fulltext_analyzer: {
                    filter: [
                      'ngram_filter', // 부분 일치
                      'edge_ngram_filter', // 자동완성
                    ],
                    type: 'custom',
                    tokenizer: 'nori_tokenizer',
                  },
                  nori_search_analyzer: {
                    filter: ['lowercase'],
                    type: 'custom',
                    tokenizer: 'nori_tokenizer',
                  },
                },
              },
            },
            mappings: {
              // 특정 필드에 어떤 분석기를 적용할지 설정
              properties: {
                district: {
                  type: 'text',
                  analyzer: 'nori_fulltext_analyzer', // 저장 시 (indexing 시) 사용
                  search_analyzer: 'nori_search_analyzer', // 검색 기 (query 시) 사용
                },
              },
            },
          },
        });

        this.logger.log(
          `ELASTICSEARCH: ✅ Index "${indexName}" created with n-gram settings`,
        );
      } else {
        this.logger.log(
          `ELASTICSEARCH: ℹ️ Index "${indexName}" already exists`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Failed to create index "${indexName}":`, error);
    }
  }

  // elastic - 데이터 (저장)
  async indexData(indexName: string, documentId: string, content: string) {
    return await this.elasticsearchService.index({
      index: indexName,
      id: documentId,
      body: { content },
    });
  }

  // elastic - search (찾기)
  async searchData(searchDto: SearchDto) {
    const { index, query, size } = searchDto;
    const [field, value] = query.split(':');

    const response = await this.elasticsearchService.search({
      index,
      body: {
        query: { match: { [field]: value } },
        ...(size && { size: +size }),
      },
    });

    // _source 필드가 있는 것만 필터링
    const hits = response.hits.hits.map((hit: any) => hit._source.district);

    return hits;
  }

  async analyzeText(
    indexName: string,
    text: string,
    analyzer: string = 'nori_fulltext_analyzer',
  ) {
    try {
      const response = await this.elasticsearchService.indices.analyze({
        index: indexName, // 분석할 인덱스 이름
        body: {
          analyzer: analyzer,
          text: text,
        },
      });

      return response;
    } catch (e) {
      console.error('⚠️ Error analyzing text:', e);
      throw e;
    }
  }

  // redis
  async locationByCount(findLocationCountDto: FindLocationCountDto) {
    const { size } = findLocationCountDto;
    const topDistricts = await this.redisLocationService.getLocationKey(+size);

    // 점수 제거 (짝수 인덱스만 가져오기)
    const districtsOnly = topDistricts.filter((_, index) => index % 2 === 0);

    return districtsOnly;
  }
}
