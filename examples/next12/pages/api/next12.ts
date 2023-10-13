import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenFeature } from '@openfeature/js-sdk';
import { setupOpenFeatureConfidenceProvider } from '../../utils/setupOpenFeatureConfidenceProvider';

setupOpenFeatureConfidenceProvider();

const client = OpenFeature.getClient();
export default async function handler(_req: NextApiRequest, res: NextApiResponse<{ strValue: string }>) {
  const strValue = await client.getStringValue('web-sdk-e2e-flag.str', 'default', { targetingKey: 'user-a' });

  res.status(200).json({ strValue });
}
