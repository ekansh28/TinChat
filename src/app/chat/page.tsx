// src/app/chat/page.tsx
import { Suspense } from 'react';
import ChatPageClientContent from './ChatPageClientContent';

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    }>
      <ChatPageClientContent />
    </Suspense>
  );
}

// Optional: Add metadata
export const metadata = {
  title: 'Chat - TinChat',
  description: 'Connect with random people and chat anonymously',
};