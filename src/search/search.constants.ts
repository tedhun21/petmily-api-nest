export const ELASTICSEARCH_PETS_SETTINGS = {
  settings: {
    analysis: {
      tokenizer: {
        ngram_tokenizer: {
          type: 'ngram',
          min_gram: 2,
          max_gram: 5,
          token_chars: ['letter', 'digit'],
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'ngram_tokenizer',
          filter: ['lowercase'] as string[], // ✅ readonly 문제 해결!
        },
      },
    },
  },
  mappings: {
    properties: {
      name: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      age: {
        type: 'integer',
      },
      type: {
        type: 'keyword',
      },
    },
  },
};
