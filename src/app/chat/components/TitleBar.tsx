import React from 'react';

interface TitleBarProps {
  isConnected: boolean;
  isPartnerConnected: boolean;
  partnerInfo?: {
    username: string;
    avatar: string;
  };
  partnerStatus: string;
}

const TitleBar: React.FC<TitleBarProps> = ({
  isConnected,
  isPartnerConnected,
  partnerInfo,
  partnerStatus,
}) => {
  const avatarUrl = partnerInfo?.avatar || '/default-avatar.png';
  const username = partnerInfo?.username || 'Stranger';

  return (
    <div className="title-bar flex items-center justify-between bg-gray-800 text-white px-4 py-2">
      <div className="flex items-center space-x-2">
        <img
          src={avatarUrl}
          alt="Partner Avatar"
          className="w-8 h-8 rounded-full border border-white"
        />
        <div>
          <div className="font-bold">{username}</div>
          <div className="text-xs text-gray-300">{partnerStatus}</div>
        </div>
      </div>

      <div className="text-xs">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'} |{' '}
        {isPartnerConnected ? '🟢 Partner Online' : '⚫ Partner Offline'}
      </div>
    </div>
  );
};

export default TitleBar;
