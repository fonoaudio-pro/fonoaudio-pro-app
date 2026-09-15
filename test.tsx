import React from 'react';
import { createRoot } from 'react-dom/client';

console.log("Test script executing...");

function TestApp() {
    return (
        <div style={{ padding: 20, background: 'red', color: 'white' }}>
            <h1>Test App Working</h1>
        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<TestApp />);
    console.log("Test render called");
} else {
    console.error("Root element not found in test");
}
