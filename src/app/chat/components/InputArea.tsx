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
    <form
      className="flex items-center border-t border-gray-300 px-4 py-2"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none"
        placeholder="Type a message..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsTyping(true)}
        onBlur={() => setIsTyping(false)}
      />
      <button
        type="submit"
        className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        Send
      </button>
    </form>
  );
};

export default InputArea;
