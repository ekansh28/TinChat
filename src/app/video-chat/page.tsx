// src/app/video-chat/page.tsx - FINAL IMPLEMENTATION
import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

// Dynamically import the client component
const VideoChatPageClientContent = dynamicImport(
  () => import('./VideoChatPageClientContent'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video chat interface...</p>
        </div>
      </div>
    )
  }
);

export default function VideoChatPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video chat interface...</p>
        </div>
      </div>
    }>
      <VideoChatPageClientContent />
    </Suspense>
  );
}

// Add metadata
export const metadata = {
  title: 'Video Chat - TinChat',
  description: 'Connect with random people through video chat',
};