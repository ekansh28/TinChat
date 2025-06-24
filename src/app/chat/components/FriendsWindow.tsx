// src/app/chat/components/FriendsWindow.tsx - COMPLETELY FIXED AUTO-AUTHENTICATION

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Users, MessageCircle, Search, Filter, Settings, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface Friend {
  id: string;
  authId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: Date;
  isFavorite?: boolean;
  badges?: string[];
  mutualFriends?: number;
}

interface FriendsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface FriendsState {
  friends: Friend[];
  pendingRequests: Array<{
    id: string;
    from: Friend;
    to: Friend;
    timestamp: Date;
    type: 'incoming' | 'outgoing';
  }>;
  blockedUsers: Friend[];
  isLoading: boolean;
  error: string | null;
}

export const FriendsWindow: React.FC<FriendsWindowProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  // ✅ CRITICAL: Auto-use authentication (no manual auth required)
  const auth = useAuth();
  
  // State management
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

  // Add friend form state
  const [addFriendQuery, setAddFriendQuery] = useState('');
  const [addFriendResults, setAddFriendResults] = useState<Friend[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Refs for cleanup
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);

  // ✅ CRITICAL: Auto-load friends data when authenticated (no manual auth step)
  useEffect(() => {
    if (!isOpen || !auth.authId || isInitializedRef.current) return;

    console.log('[FriendsWindow] 🔐 Auto-loading friends data for authenticated user:', auth.authId);
    
    isInitializedRef.current = true;
    loadFriendsData();
  }, [isOpen, auth.authId]);

  // Load friends data from API
  const loadFriendsData = useCallback(async () => {
    if (!auth.authId) {
      console.log('[FriendsWindow] ❌ No auth ID available');
      return;
    }

    setFriendsState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[FriendsWindow] 📡 Loading friends data...');
      
      // Load friends, requests, and blocked users in parallel
      const [friendsRes, requestsRes, blockedRes] = await Promise.all([
        fetch('/api/friends', {
          headers: {
            'Authorization': `Bearer ${auth.authId}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/friends/requests', {
          headers: {
            'Authorization': `Bearer ${auth.authId}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/friends/blocked', {
          headers: {
            'Authorization': `Bearer ${auth.authId}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const friendsData = friendsRes.ok ? await friendsRes.json() : { friends: [] };
      const requestsData = requestsRes.ok ? await requestsRes.json() : { requests: [] };
      const blockedData = blockedRes.ok ? await blockedRes.json() : { blocked: [] };

      setFriendsState({
        friends: friendsData.friends || [],
        pendingRequests: requestsData.requests || [],
        blockedUsers: blockedData.blocked || [],
        isLoading: false,
        error: null
      });

      console.log('[FriendsWindow] ✅ Friends data loaded:', {
        friends: friendsData.friends?.length || 0,
        requests: requestsData.requests?.length || 0,
        blocked: blockedData.blocked?.length || 0
      });

    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to load friends data:', error);
      setFriendsState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load friends data'
      }));
    }
  }, [auth.authId]);

  // Search for users to add as friends
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !auth.authId) {
      setAddFriendResults([]);
      return;
    }

    setIsSearchingUsers(true);

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${auth.authId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAddFriendResults(data.users || []);
      } else {
        setAddFriendResults([]);
      }
    } catch (error) {
      console.error('[FriendsWindow] ❌ User search failed:', error);
      setAddFriendResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }, [auth.authId]);

  // Debounced user search
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

  // Friend management actions
  const sendFriendRequest = useCallback(async (targetUserId: string) => {
    if (!auth.authId) return;

    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.authId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId })
      });

      if (response.ok) {
        console.log('[FriendsWindow] ✅ Friend request sent');
        loadFriendsData(); // Refresh data
      }
    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to send friend request:', error);
    }
  }, [auth.authId, loadFriendsData]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    if (!auth.authId) return;

    try {
      const response = await fetch(`/api/friends/request/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.authId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('[FriendsWindow] ✅ Friend request accepted');
        loadFriendsData(); // Refresh data
      }
    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to accept friend request:', error);
    }
  }, [auth.authId, loadFriendsData]);

  const removeFriend = useCallback(async (friendId: string) => {
    if (!auth.authId) return;

    try {
      const response = await fetch(`/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.authId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('[FriendsWindow] ✅ Friend removed');
        loadFriendsData(); // Refresh data
      }
    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to remove friend:', error);
    }
  }, [auth.authId, loadFriendsData]);

  // Filter and search logic
  const filteredFriends = useMemo(() => {
    let filtered = friendsState.friends;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(friend => {
        if (filterStatus === 'online') {
          return friend.status === 'online' || friend.status === 'away' || friend.status === 'busy';
        }
        return friend.status === 'offline';
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(friend =>
        friend.username.toLowerCase().includes(query) ||
        (friend.displayName && friend.displayName.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [friendsState.friends, filterStatus, searchQuery]);

  // Reset state when window closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setAddFriendQuery('');
      setAddFriendResults([]);
      setActiveTab('friends');
      isInitializedRef.current = false;
    }
  }, [isOpen]);

  // ✅ Show loading state while authentication is loading
  if (auth.isLoading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4">
              <div className="flex items-center justify-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="text-gray-700 dark:text-gray-300">Loading...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ✅ Show error if not authenticated (but don't require manual auth)
  if (!auth.authId) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="bg-white dark:bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Authentication Required
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Please log in to access your friends list.
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Users className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Friends
                </h2>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm rounded-full">
                  {filteredFriends.length}
                </span>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors group"
              >
                <X className="h-5 w-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
              {[
                { id: 'friends', label: 'Friends', count: friendsState.friends.length },
                { id: 'requests', label: 'Requests', count: friendsState.pendingRequests.length },
                { id: 'blocked', label: 'Blocked', count: friendsState.blockedUsers.length },
                { id: 'add', label: 'Add Friends', icon: UserPlus }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-4 w-4" />}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {/* Friends Tab */}
              {activeTab === 'friends' && (
                <div className="h-full flex flex-col">
                  {/* Search and Filters */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search friends..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Status</option>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                  </div>

                  {/* Friends List */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {friendsState.isLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    ) : filteredFriends.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          {searchQuery ? 'No friends found' : 'No friends yet'}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          {searchQuery
                            ? 'Try adjusting your search terms'
                            : 'Start connecting with people by adding them as friends'
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredFriends.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <img
                                  src={friend.avatarUrl || '/default-avatar.png'}
                                  alt={friend.displayName || friend.username}
                                  className="h-10 w-10 rounded-full"
                                />
                                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${
                                  friend.status === 'online' ? 'bg-green-500' :
                                  friend.status === 'away' ? 'bg-yellow-500' :
                                  friend.status === 'busy' ? 'bg-red-500' : 'bg-gray-400'
                                }`} />
                              </div>
                              
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {friend.displayName || friend.username}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                  {friend.status}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                                title="Send Message"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => removeFriend(friend.id)}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                title="Remove Friend"
                              >
                                <Trash2 className="h-4 w-4" />
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
                <div className="h-full flex flex-col p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Add New Friends
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Search for users by username or display name
                    </p>
                  </div>

                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={addFriendQuery}
                      onChange={(e) => setAddFriendQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {isSearchingUsers ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    ) : addFriendResults.length === 0 ? (
                      <div className="text-center py-12">
                        <Search className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          {addFriendQuery ? 'No users found' : 'Start searching'}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          {addFriendQuery
                            ? 'Try different search terms'
                            : 'Enter a username or display name to search for users'
                          }
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {addFriendResults.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <img
                                src={user.avatarUrl || '/default-avatar.png'}
                                alt={user.displayName || user.username}
                                className="h-10 w-10 rounded-full"
                              />
                              
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {user.displayName || user.username}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  @{user.username}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => sendFriendRequest(user.id)}
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>Add Friend</span>
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
                <div className="h-full flex flex-col p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Friend Requests
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Manage incoming and outgoing friend requests
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {friendsState.pendingRequests.length === 0 ? (
                      <div className="text-center py-12">
                        <UserPlus className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No pending requests
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Friend requests will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {friendsState.pendingRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <img
                                src={request.from.avatarUrl || '/default-avatar.png'}
                                alt={request.from.displayName || request.from.username}
                                className="h-10 w-10 rounded-full"
                              />
                              
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {request.from.displayName || request.from.username}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {request.type === 'incoming' ? 'Sent you a friend request' : 'You sent a friend request'}
                                </p>
                              </div>
                            </div>

                            {request.type === 'incoming' && (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => acceptFriendRequest(request.id)}
                                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                >
                                  Accept
                                </button>
                                <button className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors">
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Blocked Users Tab */}
              {activeTab === 'blocked' && (
                <div className="h-full flex flex-col p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Blocked Users
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Manage your blocked users list
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {friendsState.blockedUsers.length === 0 ? (
                      <div className="text-center py-12">
                        <Filter className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No blocked users
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Blocked users will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {friendsState.blockedUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <img
                                src={user.avatarUrl || '/default-avatar.png'}
                                alt={user.displayName || user.username}
                                className="h-10 w-10 rounded-full grayscale"
                              />
                              
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {user.displayName || user.username}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Blocked user
                                </p>
                              </div>
                            </div>

                            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                              Unblock
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FriendsWindow;
