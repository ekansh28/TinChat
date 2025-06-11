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
  partnerInfo,
  partnerStatus,
}) => {
  const avatarUrl = partnerInfo?.avatar || '/default-avatar.png';
  const username = partnerInfo?.username || 'Stranger';

  return (
    <div className="title-bar flex items-center justify-between bg-gray-800 text-white px-4 py-2">
    </div>
  );
};

export default TitleBar;
