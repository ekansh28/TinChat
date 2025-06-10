// src/app/chat/components/InputArea.tsx
import React, { useState } from 'react';

interface InputAreaProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (message: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ value, onChange, onSend }) => {
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      onSend(trimmed);
      onChange('');
    }
  };

  return (
    <div className="window-body" style={{ padding: '8px', borderTop: '1px solid #c0c0c0' }}>
      <form onSubmit={handleSubmit}>
        <div className="field-row" style={{ marginBottom: '8px' }}>
          <input
            type="text"
            className="field-row"
            style={{ width: '100%', marginRight: '8px' }}
            placeholder="Type a message..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsTyping(true)}
            onBlur={() => setIsTyping(false)}
          />
        </div>
        <div className="field-row" style={{ textAlign: 'right' }}>
          <button
            type="submit"
            style={{ minWidth: '60px' }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputArea;