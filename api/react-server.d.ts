import { Confidence, Logger } from '@spotify-confidence/sdk';
import React, { ReactNode } from 'react';

declare function ConfidenceProvider(props: {
    confidence: Confidence;
    clientLogger?: Logger;
    children?: ReactNode;
}): Promise<React.JSX.Element>;

export { ConfidenceProvider };
