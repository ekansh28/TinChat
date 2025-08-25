// src/app/chat/components/FriendsWindow.tsx - Clean Version

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, UserPlus, Users, MessageCircle, Search, Trash2, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

import {
  Friend,
  FriendRequest,
  FriendsWindowProps,
  FriendsState,
  FriendsApiResponse,
  FriendRequestApiData,
  FriendRequestsApiResponse,
  UserStatus
} from '../../../types/friends';

export const FriendsWindow: React.FC<FriendsWindowProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const auth = useAuth();

  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'blocked' | 'add'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [friendsState, setFriendsState] = useState<FriendsState>({
    friends: [],
    pendingRequests: [],
    blockedUsers: [],
    isLoading: false,
    error: null
  });

  const [addFriendQuery, setAddFriendQuery] = useState('');
  const [addFriendResults, setAddFriendResults] = useState<Friend[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);

  // Helper functions
  const getWindowStyles = (): React.CSSProperties => ({
    position: 'fixed',
    bottom: '45px',
    right: '20px',
    width: '380px',
    height: '600px',
    zIndex: 5500,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  });

  const getTitleBarStyles = (): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    flexShrink: 0,
    userSelect: 'none',
    cursor: 'move',
    borderBottom: '1px solid'
  });

  const getBodyStyles = (): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  });

  const getButtonStyles = (variant: 'primary' | 'secondary' | 'danger' = 'primary'): string => {
    const baseClasses = 'px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer border';
    
    switch (variant) {
      case 'primary':
        return `${baseClasses} bg-blue-500 hover:bg-blue-600 text-white border-blue-500`;
      case 'danger':
        return `${baseClasses} bg-red-500 hover:bg-red-600 text-white border-red-500`;
      case 'secondary':
      default:
        return `${baseClasses} bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white dark:border-gray-500`;
    }
  };

  const getTabStyles = (isActive: boolean): string => {
    return `px-4 py-2 text-sm font-medium cursor-pointer transition-all border-b-2 ${
      isActive 
        ? 'border-blue-500 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400' 
        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
    }`;
  };

  // Data loading functions
  const loadFriendsData = useCallback(async () => {
    if (!auth.authId) return;

    setFriendsState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const [friendsRes, requestsRes, blockedRes] = await Promise.all([
        fetch(`/api/friends/list?userId=${auth.authId}`),
        fetch(`/api/friends/request?userId=${auth.authId}`),
        fetch(`/api/friends/blocked?userId=${auth.authId}`)
      ]);

      const friendsData = friendsRes.ok ? await friendsRes.json() : { friends: [] };
      const requestsData = requestsRes.ok ? await requestsRes.json() : { requests: { received: [], sent: [] } };
      const blockedData = blockedRes.ok ? await blockedRes.json() : { blocked: [] };

      const allRequests: FriendRequest[] = [];
      if (requestsData.requests) {
        if (requestsData.requests.received) {
          allRequests.push(...requestsData.requests.received.map((req: FriendRequestApiData) => ({
            id: req.id,
            message: req.message,
            timestamp: new Date(req.created_at),
            type: 'incoming' as const,
            from: {
              id: req.sender?.clerk_id || '',
              username: req.sender?.username || '',
              displayName: req.sender?.display_name,
              avatarUrl: req.sender?.avatar_url,
              status: 'offline' as UserStatus,
              lastSeen: new Date(),
              authId: req.sender?.clerk_id || ''
            },
            to: {
              id: auth.authId,
              username: auth.username || '',
              displayName: (auth as any).displayName,
              avatarUrl: (auth as any).avatarUrl,
              status: 'online' as UserStatus,
              lastSeen: new Date(),
              authId: auth.authId
            }
          })));
        }
        
        if (requestsData.requests.sent) {
          allRequests.push(...requestsData.requests.sent.map((req: FriendRequestApiData) => ({
            id: req.id,
            message: req.message,
            timestamp: new Date(req.created_at),
            type: 'outgoing' as const,
            from: {
              id: auth.authId,
              username: auth.username || '',
              displayName: (auth as any).displayName,
              avatarUrl: (auth as any).avatarUrl,
              status: 'online' as UserStatus,
              lastSeen: new Date(),
              authId: auth.authId
            },
            to: {
              id: req.receiver?.clerk_id || '',
              username: req.receiver?.username || '',
              displayName: req.receiver?.display_name,
              avatarUrl: req.receiver?.avatar_url,
              status: 'offline' as UserStatus,
              lastSeen: new Date(),
              authId: req.receiver?.clerk_id || ''
            }
          })));
        }
      }

      setFriendsState({
        friends: friendsData.friends || [],
        pendingRequests: allRequests,
        blockedUsers: blockedData.blocked || [],
        isLoading: false,
        error: null
      });

    } catch (error) {
      setFriendsState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load friends data'
      }));
    }
  }, [auth.authId]);

  // Load friends data when opened
  useEffect(() => {
    if (!isOpen || !auth.authId || isInitializedRef.current) return;
    isInitializedRef.current = true;
    loadFriendsData();
  }, [isOpen, auth.authId, loadFriendsData]);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !auth.authId) {
      setAddFriendResults([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const response = await fetch('/api/friends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerm: query.trim(),
          currentUserAuthId: auth.authId,
          limit: 20
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAddFriendResults(data.users || []);
      } else {
        setAddFriendResults([]);
      }
    } catch (error) {
      setAddFriendResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }, [auth.authId]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(addFriendQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [addFriendQuery, searchUsers]);

  // Friend actions
  const sendFriendRequest = useCallback(async (targetUserId: string) => {
    if (!auth.authId) return;
    try {
      const response = await fetch('/api/friends/request/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAuthId: auth.authId,
          receiverAuthId: targetUserId,
          message: null
        })
      });

      if (response.ok) {
        setAddFriendResults(prev => prev.filter(user => user.id !== targetUserId));
        loadFriendsData();
      }
    } catch (error) {
      // Handle error silently
    }
  }, [auth.authId, loadFriendsData]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    if (!auth.authId) return;
    try {
      const response = await fetch('/api/friends/request/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          accepterAuthId: auth.authId
        })
      });

      if (response.ok) {
        loadFriendsData();
      }
    } catch (error) {
      // Handle error silently
    }
  }, [auth.authId, loadFriendsData]);

  const removeFriend = useCallback(async (friendId: string) => {
    if (!auth.authId) return;
    try {
      const response = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAuthId: auth.authId,
          friendAuthId: friendId
        })
      });

      if (response.ok) {
        loadFriendsData();
      }
    } catch (error) {
      // Handle error silently
    }
  }, [auth.authId, loadFriendsData]);

  // Filter friends
  const filteredFriends = useMemo(() => {
    let filtered = friendsState.friends;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(friend => {
        if (filterStatus === 'online') {
          return friend.status === 'online' || friend.status === 'idle' || friend.status === 'dnd';
        }
        return friend.status === 'offline';
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(friend =>
        friend.username.toLowerCase().includes(query) ||
        (friend.displayName && friend.displayName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [friendsState.friends, filterStatus, searchQuery]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setAddFriendQuery('');
      setAddFriendResults([]);
      setActiveTab('friends');
      isInitializedRef.current = false;
    }
  }, [isOpen]);

  // Don't render if not authenticated or not open
  if (!auth.authId || !isOpen) return null;

  return (
    <div
      style={getWindowStyles()}
      className={`window bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl ${className}`}
    >
      {/* Title Bar */}
      <div 
        className="title-bar bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 rounded-t-lg" 
        style={getTitleBarStyles()}
      >
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Users size={16} className="text-blue-500" />
          <span className="font-semibold">Friends</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Window Body */}
      <div className="flex flex-col flex-1 bg-white dark:bg-gray-800" style={getBodyStyles()}>
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          {[
            { id: 'friends', label: 'Friends', count: friendsState.friends.length },
            { id: 'requests', label: 'Requests', count: friendsState.pendingRequests.length },
            { id: 'blocked', label: 'Blocked', count: friendsState.blockedUsers.length },
            { id: 'add', label: 'Add', icon: true }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={getTabStyles(activeTab === tab.id)}
            >
              <div className="flex items-center gap-1">
                {tab.icon && <UserPlus size={14} />}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[16px] h-4 flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search and Filter */}
              <div className="p-3 flex gap-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              {/* Friends List */}
              <div className="flex-1 overflow-auto p-4">
                {friendsState.isLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="mx-auto mb-2" size={24} />
                    <p>Loading friends...</p>
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="mx-auto mb-2" size={24} />
                    <p>{searchQuery ? 'No friends found' : 'No friends yet'}</p>
                    <p className="text-sm mt-1">Use the Add tab to find friends!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
                      >
                        {/* Avatar with status */}
                        <div className="relative mr-3">
                          <img
                            src={friend.avatar_url || friend.avatarUrl || '/default-avatar.png'}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml;base64,' + btoa(`
                                <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="40" height="40" fill="#6B7280"/>
                                  <text x="20" y="26" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
                                    ${(friend.display_name || friend.displayName || friend.username).charAt(0).toUpperCase()}
                                  </text>
                                </svg>
                              `);
                            }}
                          />
                          
                          {/* Status indicator */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                            friend.status === 'online' ? 'bg-green-500' :
                            friend.status === 'idle' ? 'bg-yellow-500' :
                            friend.status === 'dnd' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {friend.display_name || friend.displayName || friend.username}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {friend.status}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-2 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-colors"
                            title="Start Chat"
                          >
                            <MessageCircle size={16} />
                          </button>
                          <button
                            onClick={() => removeFriend(friend.id)}
                            title="Remove Friend"
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add Friends Tab */}
          {activeTab === 'add' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search for users to add..."
                    value={addFriendQuery}
                    onChange={(e) => setAddFriendQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {isSearchingUsers ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p>Searching users...</p>
                  </div>
                ) : addFriendResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <UserPlus className="mx-auto mb-2" size={24} />
                    <p>{addFriendQuery ? 'No users found' : 'Enter a username to search'}</p>
                    <p className="text-sm mt-1">Try searching for exact usernames</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addFriendResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <img
                          src={user.avatarUrl || user.avatar_url || '/default-avatar.png'}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 mr-3"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,' + btoa(`
                              <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                                <rect width="40" height="40" fill="#3B82F6"/>
                                <text x="20" y="26" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
                                  ${(user.displayName || user.username).charAt(0).toUpperCase()}
                                </text>
                              </svg>
                            `);
                          }}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {user.displayName || user.username}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            @{user.username}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => sendFriendRequest(user.id)}
                          className={getButtonStyles('primary')}
                        >
                          <UserPlus size={14} className="mr-1" />
                          Add Friend
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Friend Requests Tab */}
          {activeTab === 'requests' && (
            <div className="flex-1 overflow-auto p-4">
              {friendsState.pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <UserCheck className="mx-auto mb-2" size={24} />
                  <p>No pending requests</p>
                  <p className="text-sm mt-1">Friend requests will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friendsState.pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <img
                        src={request.from.avatarUrl || request.from.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 mr-4"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,' + btoa(`
                            <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
                              <rect width="48" height="48" fill="#10B981"/>
                              <text x="24" y="30" font-family="Arial" font-size="18" fill="white" text-anchor="middle">
                                ${(request.from.displayName || request.from.username).charAt(0).toUpperCase()}
                              </text>
                            </svg>
                          `);
                        }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {request.from.displayName || request.from.username}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {request.type === 'incoming' ? 'Sent you a friend request' : 'You sent a friend request'}
                        </div>
                        {request.message && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                            "{request.message}"
                          </div>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {request.timestamp.toLocaleDateString()}
                        </div>
                      </div>

                      {request.type === 'incoming' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptFriendRequest(request.id)}
                            className={getButtonStyles('primary')}
                          >
                            <UserCheck size={14} className="mr-1" />
                            Accept
                          </button>
                          <button
                            className={getButtonStyles('danger')}
                          >
                            <UserX size={14} className="mr-1" />
                            Decline
                          </button>
                        </div>
                      )}

                      {request.type === 'outgoing' && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 bg-yellow-100 dark:bg-yellow-900 px-3 py-1 rounded-full">
                          Pending
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Blocked Users Tab */}
          {activeTab === 'blocked' && (
            <div className="flex-1 overflow-auto p-4">
              {friendsState.blockedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <UserX className="mx-auto mb-2" size={24} />
                  <p>No blocked users</p>
                  <p className="text-sm mt-1">Blocked users will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friendsState.blockedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex-1 text-gray-900 dark:text-gray-100">
                        {user.displayName || user.username}
                      </div>
                      <button
                        className={getButtonStyles('secondary')}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {friendsState.error && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 border border-red-500 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
                <div className="flex items-center mb-4">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Error</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {friendsState.error}
                </p>
                <button
                  onClick={() => setFriendsState(prev => ({ ...prev, error: null }))}
                  className={getButtonStyles('primary')}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsWindow;