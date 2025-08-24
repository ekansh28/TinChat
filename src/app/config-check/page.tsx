'use client';

export default function ConfigCheck() {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'Unknown';
  const currentPort = typeof window !== 'undefined' ? window.location.port : 'Unknown';
  
  // Expected URLs that should be configured in Clerk
  const expectedUrls = [
    `${currentOrigin}/`,
    `${currentOrigin}/oauth-test`,
    `${currentOrigin}/debug`,
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Clerk Configuration Check</h1>
      
      {/* Current Environment */}
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Current Environment</h2>
        <div className="space-y-2">
          <p><strong>Origin:</strong> {currentOrigin}</p>
          <p><strong>Port:</strong> {currentPort}</p>
          <p><strong>Protocol:</strong> {typeof window !== 'undefined' ? window.location.protocol : 'Unknown'}</p>
        </div>
      </div>

      {/* Clerk Dashboard Configuration */}
      <div className="mb-8 p-4 border rounded bg-yellow-50">
        <h2 className="text-xl font-semibold mb-4">⚠️ Required Clerk Dashboard Settings</h2>
        
        <div className="mb-6">
          <h3 className="font-semibold mb-2">1. OAuth Providers (Google/Discord)</h3>
          <p className="text-sm text-gray-600 mb-2">Go to: Clerk Dashboard → Configure → SSO Connections</p>
          <div className="bg-white p-3 rounded border">
            <p><strong>Authorized Redirect URLs should include:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {expectedUrls.map((url, index) => (
                <li key={index} className="font-mono text-sm">{url}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">2. Webhooks</h3>
          <p className="text-sm text-gray-600 mb-2">Go to: Clerk Dashboard → Configure → Webhooks</p>
          <div className="bg-white p-3 rounded border">
            <p><strong>Endpoint URL:</strong></p>
            <p className="font-mono text-sm">{currentOrigin}/api/webhooks/clerk</p>
            <p className="mt-2"><strong>Events to enable:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
              <li>user.created</li>
              <li>user.updated</li>
              <li>user.deleted</li>
            </ul>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">3. Allowed Origins</h3>
          <p className="text-sm text-gray-600 mb-2">Go to: Clerk Dashboard → Configure → Domains</p>
          <div className="bg-white p-3 rounded border">
            <p><strong>Add to allowed origins:</strong></p>
            <p className="font-mono text-sm">{currentOrigin}</p>
          </div>
        </div>
      </div>

      {/* Environment Variables Check */}
      <div className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Environment Variables Status</h2>
        <div className="space-y-2">
          <p><strong>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:</strong> 
            <span className={`ml-2 px-2 py-1 rounded text-sm ${
              process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Set' : 'Missing'}
            </span>
          </p>
        </div>
      </div>

      {/* Quick Tests */}
      <div className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Quick Tests</h2>
        <div className="space-y-2">
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/test-webhook');
                const data = await response.json();
                alert(`Webhook test: ${JSON.stringify(data, null, 2)}`);
              } catch (error) {
                alert(`Webhook test failed: ${error}`);
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
          >
            Test Webhook Endpoint
          </button>
          
          <button
            onClick={() => {
              window.open('/oauth-test', '_blank');
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Open OAuth Test Page
          </button>
        </div>
      </div>
    </div>
  );
}