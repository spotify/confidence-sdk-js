import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';
import { ClientSetup } from '@spotify-confidence/integration-next/Next12';
import {useStringValue} from "@spotify-confidence/integration-next";
import {clientProvider} from "../../utils/client-provider";
import {serverProvider} from "../../utils/server-provider";

function TestComponent() {
    const str = useStringValue('web-sdk-e2e-flag.str', 'default');
    return <p>{str}</p>;
}

export default function Old(props: any) {
    const { serializedConfig } = props;

    return (
        <ClientSetup
            clientProvider={clientProvider}
            context={{ targetingKey: 'user-a' }}
            serializedConfig={serializedConfig}
            fallback={<p>Loading...</p>}
        >
            <TestComponent />
        </ClientSetup>
    );
}

export async function getServerSideProps() {
    OpenFeature.setProvider(serverProvider);

    const fromSSP = await OpenFeature.getClient().getBooleanValue('web-sdk-e2e-flag.str', true, {
        targetingKey: 'user-a',
    });

    return { props: { serializedConfig: serverProvider.serialize() } };
}