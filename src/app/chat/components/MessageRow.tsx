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
      <div className="text-center text-gray-500 text-sm my-2">
        {message.content}
      </div>
    );
  }

  return (
    <div
      className={`flex ${isSelf ? 'justify-end' : 'justify-start'} my-1`}
    >
      <div
        className={`px-3 py-2 rounded-lg max-w-xs break-words text-sm shadow-md ${
          isSelf
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 text-gray-800'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
};

export default MessageRow;
