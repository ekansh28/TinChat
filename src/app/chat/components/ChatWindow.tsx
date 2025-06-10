import React from 'react';
import TitleBar from './TitleBar';
import MessageRow from './MessageRow';
import PartnerTypingIndicator from './PartnerTypingIndicator';
import InputArea from './InputArea';

interface ChatWindowProps {
  messages: any[];
  onSendMessage: (msg: string) => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  isPartnerTyping: boolean;
  partnerStatus: string;
  partnerInfo?: {
    username: string;
    avatar: string;
  };
  isConnected: boolean;
  isPartnerConnected: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onSendMessage,
  inputValue,
  onInputChange,
  isPartnerTyping,
  partnerStatus,
  partnerInfo,
  isConnected,
  isPartnerConnected,
}) => {
  return (
    <div className="window chat-window flex flex-col justify-between w-full h-full">
      <TitleBar
        isConnected={isConnected}
        isPartnerConnected={isPartnerConnected}
        partnerInfo={partnerInfo}
        partnerStatus={partnerStatus}
      />

      <div className="messages flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {messages.map((msg, index) => (
          <MessageRow key={index} message={msg} />
        ))}
        <PartnerTypingIndicator isTyping={isPartnerTyping} />
      </div>

      <InputArea
        value={inputValue}
        onChange={onInputChange}
        onSend={onSendMessage}
      />
    </div>
  );
};

export default ChatWindow;
