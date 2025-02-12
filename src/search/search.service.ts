import { Injectable, OnModuleInit } from '@nestjs/common';

import { ElasticsearchService } from '@nestjs/elasticsearch';
import { getLocations } from 'src/common/location/location.utils';
import { RedisService } from 'src/redis/redis.service';
@Injectable()
export class SearchService implements OnModuleInit {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    try {
      await this.elasticsearchService.ping();
      console.log('ELASTICSEARCH: ✅ Elasticsearch is connected');

      await this.createIndex('locations');
      await this.seedLocations();
    } catch (error) {
      console.error(
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
              analysis: {
                tokenizer: {
                  nori_tokenizer: {
                    type: 'nori_tokenizer',
                  },
                },
                filter: {
                  ngram_filter: {
                    type: 'ngram',
                    min_gram: 2,
                    max_gram: 3,
                  },
                  edge_ngram_filter: {
                    type: 'edge_ngram',
                    min_gram: 1,
                    max_gram: 10,
                  },
                },
                analyzer: {
                  nori_autocomplete_analyzer: {
                    filter: ['edge_ngram_filter'],
                    type: 'custom',
                    tokenizer: 'nori_tokenizer',
                  },
                  nori_fulltext_analyzer: {
                    filter: ['ngram_filter', 'edge_ngram_filter'],
                    type: 'custom',
                    tokenizer: 'nori_tokenizer',
                  },
                },
              },
            },
            mappings: {
              properties: {
                district: {
                  type: 'text',
                  analyzer: 'nori_fulltext_analyzer', // ngram 필터 사용
                  search_analyzer: 'nori_autocomplete_analyzer', // edge_ngram 필터 사용
                },
              },
            },
          },
        });

        console.log(
          `ELASTICSEARCH: ✅ Index "${indexName}" created with n-gram settings`,
        );
      } else {
        console.log(`ELASTICSEARCH: ℹ️ Index "${indexName}" already exists`);
      }
    } catch (error) {
      console.error(`❌ Failed to create index "${indexName}":`, error);
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
  async searchData(indexName: string, query: string, size?: string) {
    const [field, value] = query.split(':');

    const response = await this.elasticsearchService.search({
      index: indexName,
      body: {
        query: { match: { [field]: value } },
        ...(size && { size: +size }),
      },
    });

    // _source 필드가 있는 것만 필터링
    const hits = response.hits.hits.map((hit: any) => hit._source.district);

    return hits;
  }

  // redis -
  async locationByCount(size: string) {
    const topDistricts = await this.redisService.getLocationKey(+size);

    // 점수 제거 (짝수 인덱스만 가져오기)
    const districtsOnly = topDistricts.filter((_, index) => index % 2 === 0);

    return districtsOnly;
  }
}
