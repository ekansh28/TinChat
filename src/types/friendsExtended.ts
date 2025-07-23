// src/types/friendsExtended.ts - Extended types for backward compatibility
import { ChatMessage as BaseChatMessage, Friend } from './friends';

// ✅ Extended ChatMessage interface with backward compatibility
export interface ExtendedChatMessage extends BaseChatMessage {
  isFromSelf?: boolean; // Optional for backward compatibility
}

// ✅ Helper function to determine if message is from current user
export const isMessageFromSelf = (message: BaseChatMessage, currentUserId: string = 'current-user'): boolean => {
  return message.senderId === currentUserId;
};

// ✅ Helper function to transform ChatMessage to include isFromSelf
export const extendChatMessage = (message: BaseChatMessage, currentUserId: string = 'current-user'): ExtendedChatMessage => {
  return {
    ...message,
    isFromSelf: isMessageFromSelf(message, currentUserId)
  };
};

// ✅ Helper function to create a new chat message
export const createChatMessage = (
  senderId: string,
  receiverId: string,
  messageText: string,
  currentUserId: string = 'current-user'
): ExtendedChatMessage => {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    senderId,
    receiverId,
    message: messageText,
    timestamp: Date.now(),
    read: false,
    isFromSelf: senderId === currentUserId
  };
};

// Re-export other types for convenience
export type { Friend } from './friends';
export type { OpenChat } from './friends';