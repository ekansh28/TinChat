// src/app/video-chat/VideoChatClientWrapper.tsx - CLIENT COMPONENT FOR DYNAMIC LOADING
'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// ✅ CRITICAL: Use dynamic import with ssr: false in client component
const VideoChatPageClientContent = dynamic(
  () => import('./VideoChatPageClientContent'),
  {
    ssr: false, // ✅ Now allowed since this is a client component
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-4 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video chat interface...</p>
          <p className="mt-2 text-sm text-gray-400">
            Initializing camera and connection...
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-2 text-xs text-gray-500">
              Development Mode: Preventing SSR hydration issues
            </p>
          )}
        </div>
      </div>
    )
  }
);

export default function VideoChatClientWrapper() {
  return (
    <div className="min-h-screen w-full">
      <Suspense fallback={
        <div className="flex flex-1 items-center justify-center p-4 min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading video chat interface...</p>
            <p className="mt-2 text-sm text-gray-400">
              Preparing video chat components...
            </p>
          </div>
        </div>
      }>
        <VideoChatPageClientContent />
      </Suspense>
    </div>
  );
}