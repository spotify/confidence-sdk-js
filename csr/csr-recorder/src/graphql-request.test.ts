import { describe, expect, it } from 'vitest';
import { extractGraphQLRequestMetadata } from './graphql-request';

describe('extractGraphQLRequestMetadata', () => {
  it('uses the explicit operation name', () => {
    const body = JSON.stringify({
      operationName: 'UpdateProfile',
      query: 'mutation UpdateProfile($input: ProfileInput!) { updateProfile(input: $input) { id } }',
      variables: { input: { displayName: 'Private value' } },
    });

    expect(extractGraphQLRequestMetadata('/graphql', body)).toEqual({ operationName: 'UpdateProfile' });
  });

  it('gets the operation name from the document when it is not explicit', () => {
    const body = JSON.stringify({ query: 'query Viewer { viewer { id email } }' });

    expect(extractGraphQLRequestMetadata('/graphql', body)).toEqual({ operationName: 'Viewer' });
  });

  it('does not record anonymous query fields', () => {
    expect(extractGraphQLRequestMetadata('/graphql', '{ viewer { id email } }')).toBeUndefined();
  });

  it('ignores requests to other paths', () => {
    expect(extractGraphQLRequestMetadata('/api/query', 'query Viewer { viewer { id } }')).toBeUndefined();
  });
});
