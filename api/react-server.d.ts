import { Confidence } from '@spotify-confidence/sdk';
import React, { ReactNode } from 'react';

declare function ConfidenceProvider(props: {
    confidence: Confidence;
    children?: ReactNode;
}): Promise<React.JSX.Element>;

export { ConfidenceProvider };
