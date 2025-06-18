// src/app/video-chat/page.tsx - FIXED FOR NEXT.JS 13+ APP ROUTER
import React from 'react';
import VideoChatClientWrapper from './VideoChatClientWrapper';

export default function VideoChatPage() {
  return <VideoChatClientWrapper />;
}

// Add metadata for SEO
export const metadata = {
  title: 'Video Chat - TinChat',
  description: 'Connect with random people through video chat',
};
