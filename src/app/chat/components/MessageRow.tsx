// src/app/chat/components/MessageRow.tsx
import React from 'react';

interface MessageRowProps {
  message: {
    id?: string;
    content: string;
    sender: 'self' | 'partner' | 'system';
    timestamp?: number;
  };
}

const MessageRow: React.FC<MessageRowProps> = ({ message }) => {
  const isSelf = message.sender === 'self';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div style={{ 
        textAlign: 'center', 
        color: '#666', 
        fontSize: '11px', 
        margin: '4px 0',
        fontStyle: 'italic'
      }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: isSelf ? 'flex-end' : 'flex-start',
      margin: '4px 0'
    }}>
      <div 
        className="window-body"
        style={{
          maxWidth: '70%',
          padding: '4px 8px',
          fontSize: '11px',
          backgroundColor: isSelf ? '#c0c0c0' : '#ffffff',
          border: isSelf ? '1px inset #c0c0c0' : '1px outset #c0c0c0',
          wordWrap: 'break-word'
        }}
      >
        {message.content}
      </div>
    </div>
  );
};

export default MessageRow;