'use client'
import {useConfidence} from "@spotify-confidence/react";

export type ButtonStyleFlag = {
    inverted: boolean;
}

export function Flags() {
    const confidence = useConfidence();
    const flagData = JSON.stringify(confidence.useEvaluateFlag('button-style',
        {"inverted": false}), null, '  ');
    // const flagData = useDeferredValue(confidence.useFlag('web-sdk-e2e-flag.str', 'default'));
    return (
        <fieldset>
            <legend>Flags</legend>
            <pre>{flagData}</pre>
        </fieldset>
    );
}