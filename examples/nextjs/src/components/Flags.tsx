'use client';
import { useConfidence } from '@spotify-confidence/react';

export type ButtonStyleFlag = {
  inverted: boolean;
};

export function Flags() {
  const confidence = useConfidence();
  const flagData = JSON.stringify(confidence.useEvaluateFlag('button-style', { inverted: false }), null, '  ');
  return (
    <fieldset>
      <legend>Flags</legend>
      <pre>{flagData}</pre>
    </fieldset>
  );
}
