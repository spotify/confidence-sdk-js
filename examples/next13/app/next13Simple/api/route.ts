import { setupOpenFeatureConfidenceProvider } from '@/utils/setupOpenFeatureConfidenceProvider';
import { OpenFeature } from '@openfeature/js-sdk';
import { NextResponse } from 'next/server';

setupOpenFeatureConfidenceProvider();

export async function GET() {
  const strValue = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  return NextResponse.json({ strValue });
}
