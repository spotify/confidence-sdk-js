'use client';

import { useConfidence, useFlag } from '@spotify-confidence/react/client';

export function FlagDisplay() {
    console.log("rendering flag display")

    const buttonStyle = useFlag('button-style', { inverted: false });

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Home Page</h1>
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-lg font-semibold mb-2">Button Style Flag:</h2>
                <pre className="bg-gray-100 p-4 rounded">
                    {JSON.stringify(buttonStyle, null, 2)}
                </pre>
            </div>
        </div>
    );
} 