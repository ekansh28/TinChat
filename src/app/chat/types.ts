// src/app/chat/types.ts

export interface Message {
  id: string;
  content: string;
  userId: string;
  username: string;
  timestamp: number;
}

export interface Participant {
  userId: string;
  username: string;
  lastActive: number;
}

export interface ChatState {
  messages: Message[];
  participants: Map<string, Participant>;
  isTyping: Set<string>;
  currentRoom: string | null;
}