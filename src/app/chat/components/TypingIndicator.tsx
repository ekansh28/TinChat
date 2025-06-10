import React from 'react';

interface TypingIndicatorProps {
  isTyping: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping }) => {
  if (!isTyping) return null;

  return (
    <div className="text-xs text-gray-500 italic px-4 py-1">
      Stranger is typing...
    </div>
  );
};

export default TypingIndicator;