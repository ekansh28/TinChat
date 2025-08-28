// src/ChatPage.tsx
import React, { useRef, useEffect, useState } from 'react';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';
import useElementSize from '@charlietango/use-element-size'; // ✅ default import
import { cn } from '@/lib/utils';

// Message interface (can be imported from your types)
interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner' | 'system';
  timestamp: Date;
}
interface ChatPageProps {
  messages: Message[];
}

const ChatPage: React.FC<ChatPageProps> = ({ messages }) => {
  const listRef = useRef<List>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [chatWindowHeight, setChatWindowHeight] = useState(0);

  const [elementSizeRef, elementSize] = useElementSize();

  // Recalculate chat height when size changes
  useEffect(() => {
    if (chatContainerRef.current) {
      setChatWindowHeight(chatContainerRef.current.clientHeight);
    }
  }, [elementSize]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages]);

  const itemHeight = 50;
  const chatWindowWidth = elementSize.width || 0;

  // Merge refs correctly
  const combinedRef = (node: HTMLDivElement | null) => {
    chatContainerRef.current = node;
    elementSizeRef(node);
  };

  // Row renderer
  const Row = ({ index, style, data }: ListChildComponentProps<{ data: Message[] }>) => {
    const msg = data.data[index];
    return (
      <li
        key={msg.id}
        className={cn(
          'flex mb-1',
          msg.sender === 'me' ? 'justify-end' : 'justify-start'
        )}
        style={style}
      >
        <div
          className={cn(
            'rounded-lg px-3 py-1 max-w-xs lg:max-w-md break-words',
            msg.sender === 'me'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-800'
          )}
        >
          {msg.text}
        </div>
        {msg.sender !== 'system' && (
          <span className="text-xxs text-gray-400 ml-1 self-end">
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="chat-page-container">
      <div className="flex-grow" ref={combinedRef}>
        {chatWindowHeight > 0 && chatWindowWidth > 0 && (
          <List
            ref={listRef}
            height={chatWindowHeight}
            itemCount={messages.length}
            itemSize={itemHeight}
            width="100%"
            itemData={{ data: messages }}
          >
            {Row}
          </List>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
