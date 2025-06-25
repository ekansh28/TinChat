// src/app/chat/components/FriendsWindow.tsx - UPDATED WITH THEME SUPPORT AND VERTICAL LAYOUT

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Users, MessageCircle, Search, Filter, Settings, Trash2, UserX, UserCheck } from 'lucide-react';
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

interface FriendRequest {
  id: string;
  from: Friend;
  to: Friend;
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  message?: string;
}

interface FriendsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface FriendsState {
  friends: Friend[];
  pendingRequests: FriendRequest[];
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
  
  // ✅ THEME DETECTION: Check which theme is active
  const [currentTheme, setCurrentTheme] = useState<'win98' | 'win7' | 'winxp'>('win98');
  
  const checkCurrentTheme = useCallback(() => {
    if (typeof window === 'undefined') return 'win98';
    
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const winxpLink = document.getElementById('winxp-css-link') as HTMLLinkElement;
    
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    const hasWinXPCSS = winxpLink && winxpLink.href.includes('xp.css');
    
    if (hasWin7CSS) return 'win7';
    if (hasWinXPCSS) return 'winxp';
    return 'win98';
  }, []);

  useEffect(() => {
    const updateTheme = () => {
      setCurrentTheme(checkCurrentTheme());
    };
    
    updateTheme();
    
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.head, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, [checkCurrentTheme]);
  
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

  // ✅ THEME-BASED STYLING: Get styles based on current theme
  const getWindowStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      bottom: '45px', // Above taskbar
      right: '20px',
      width: '320px',
      height: '500px', // ✅ VERTICAL RECTANGLE
      zIndex: 5500,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    };

    switch (currentTheme) {
      case 'win7':
        return {
          ...baseStyles,
          background: 'rgba(240, 240, 240, 0.98)',
          border: '1px solid #999',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
          bottom: '45px',
        };
      case 'winxp':
        return {
          ...baseStyles,
          background: '#ece9d8',
          border: '1px solid #0054e3',
          borderRadius: '8px 8px 0 0',
          bottom: '35px',
        };
      default: // win98
        return {
          ...baseStyles,
          background: '#c0c0c0',
          border: '3px outset #c0c0c0',
          bottom: '37px',
        };
    }
  };

  const getTitleBarStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px',
      flexShrink: 0,
      userSelect: 'none',
      cursor: 'move' // Make it draggable-looking
    };

    switch (currentTheme) {
      case 'win7':
        return {
          ...baseStyles,
          height: '32px',
          background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)',
          borderBottom: '1px solid #ccc',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          color: '#333',
        };
      case 'winxp':
        return {
          ...baseStyles,
          height: '28px',
          background: 'linear-gradient(to bottom, #0054e3, #0040b3)',
          color: '#fff',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          fontFamily: 'Tahoma, sans-serif',
          fontSize: '11px',
          fontWeight: 'bold'
        };
      default: // win98
        return {
          ...baseStyles,
          height: '26px',
          background: '#c0c0c0',
          color: '#000',
          fontSize: '11px',
          fontWeight: 'bold'
        };
    }
  };

  const getBodyStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    };

    switch (currentTheme) {
      case 'win7':
        return {
          ...baseStyles,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(5px)',
          color: '#333',
        };
      case 'winxp':
        return {
          ...baseStyles,
          background: '#ece9d8',
          color: '#000',
        };
      default: // win98
        return {
          ...baseStyles,
          background: '#c0c0c0',
          color: '#000',
        };
    }
  };

  const getButtonStyles = (variant: 'primary' | 'secondary' | 'danger' = 'primary'): React.CSSProperties => {
    let baseColor = '#0078d4';
    if (variant === 'secondary') baseColor = '#666';
    if (variant === 'danger') baseColor = '#d83b01';

    switch (currentTheme) {
      case 'win7':
        return {
          padding: '4px 8px',
          border: `1px solid ${baseColor}`,
          borderRadius: '3px',
          background: `linear-gradient(to bottom, ${baseColor}20, ${baseColor}10)`,
          color: baseColor,
          fontSize: '11px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        };
      case 'winxp':
        return {
          padding: '3px 8px',
          border: `1px solid ${baseColor}`,
          borderRadius: '3px',
          background: variant === 'primary' ? baseColor : '#ece9d8',
          color: variant === 'primary' ? '#fff' : baseColor,
          fontSize: '11px',
          fontFamily: 'Tahoma, sans-serif',
          cursor: 'pointer'
        };
      default: // win98
        return {
          padding: '2px 6px',
          border: '1px outset #c0c0c0',
          background: '#c0c0c0',
          color: '#000',
          fontSize: '11px',
          cursor: 'pointer'
        };
    }
  };

  const getTabStyles = (isActive: boolean): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      padding: '6px 12px',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: 'normal',
      transition: 'all 0.2s',
      border: 'none',
      background: 'none'
    };

    switch (currentTheme) {
      case 'win7':
        return {
          ...baseStyles,
          background: isActive ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
          color: isActive ? '#333' : '#666',
          borderBottom: isActive ? '2px solid #0078d4' : '2px solid transparent'
        };
      case 'winxp':
        return {
          ...baseStyles,
          background: isActive ? '#fff' : 'rgba(255, 255, 255, 0.3)',
          color: isActive ? '#000' : '#333',
          border: isActive ? '1px solid #ccc' : '1px solid transparent',
          borderBottom: 'none',
          fontFamily: 'Tahoma, sans-serif'
        };
      default: // win98
        return {
          ...baseStyles,
          background: isActive ? '#c0c0c0' : '#a0a0a0',
          border: isActive ? '1px outset #c0c0c0' : '1px outset #a0a0a0',
          color: '#000'
        };
    }
  };

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
        fetch(`/api/friends/list?userId=${auth.authId}`),
        fetch(`/api/friends/requests?userId=${auth.authId}`),
        fetch(`/api/friends/blocked?userId=${auth.authId}`)
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
      const response = await fetch('/api/friends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query.trim(),
          currentUserId: auth.authId 
        })
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
      const response = await fetch('/api/friends/request/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fromUserId: auth.authId,
          toUserId: targetUserId 
        })
      });

      if (response.ok) {
        console.log('[FriendsWindow] ✅ Friend request sent');
        setAddFriendResults(prev => prev.filter(user => user.id !== targetUserId));
        loadFriendsData(); // Refresh data
      }
    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to send friend request:', error);
    }
  }, [auth.authId, loadFriendsData]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    if (!auth.authId) return;

    try {
      const response = await fetch('/api/friends/request/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, userId: auth.authId })
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
      const response = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.authId,
          friendId
        })
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
    return null; // Don't show window while loading
  }

  // ✅ Don't show if not authenticated
  if (!auth.authId) {
    return null;
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`friends-window ${currentTheme === 'win7' ? 'glass active' : ''} ${currentTheme === 'winxp' ? 'xp-window' : ''} ${className}`}
        style={getWindowStyles()}
      >
        {/* ✅ TITLE BAR with theme styling */}
        <div style={getTitleBarStyles()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={16} />
            <span>Friends</span>
            {friendsState.friends.length > 0 && (
              <span style={{
                background: currentTheme === 'win98' ? '#fff' : 'rgba(255,255,255,0.8)',
                color: '#000',
                padding: '2px 6px',
                borderRadius: currentTheme === 'win98' ? '0' : '10px',
                fontSize: '9px',
                border: currentTheme === 'win98' ? '1px inset #c0c0c0' : 'none'
              }}>
                {friendsState.friends.length}
              </span>
            )}
          </div>
          
          <button
            onClick={onClose}
            style={{
              ...getButtonStyles('danger'),
              width: '18px',
              height: '18px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        </div>

        {/* ✅ WINDOW BODY with theme styling */}
        <div style={getBodyStyles()}>
          
          {/* ✅ TABS with theme styling */}
          <div style={{
            display: 'flex',
            borderBottom: currentTheme === 'win98' ? '1px solid #808080' : '1px solid #ccc',
            background: currentTheme === 'win7' ? 'rgba(255, 255, 255, 0.5)' : 
                       currentTheme === 'winxp' ? '#e0e0e0' : '#c0c0c0'
          }}>
            {[
              { id: 'friends', label: 'Friends', count: friendsState.friends.length },
              { id: 'requests', label: 'Requests', count: friendsState.pendingRequests.length },
              { id: 'blocked', label: 'Blocked', count: friendsState.blockedUsers.length },
              { id: 'add', label: 'Add', icon: true }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={getTabStyles(activeTab === tab.id)}
              >
                {tab.icon && <UserPlus size={12} style={{ marginRight: '4px' }} />}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{
                    marginLeft: '4px',
                    background: activeTab === tab.id ? '#0078d4' : '#ccc',
                    color: activeTab === tab.id ? '#fff' : '#000',
                    padding: '1px 4px',
                    borderRadius: '8px',
                    fontSize: '9px'
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ✅ CONTENT AREA */}
          <div style={{ 
            flex: 1, 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column',
            padding: '8px'
          }}>
            
            {/* ✅ FRIENDS TAB */}
            {activeTab === 'friends' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Search and Filter */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        fontSize: '11px',
                        border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                        borderRadius: currentTheme === 'win98' ? '0' : '3px',
                        background: '#fff'
                      }}
                    />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as any)}
                      style={{
                        padding: '4px',
                        fontSize: '11px',
                        border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                        borderRadius: currentTheme === 'win98' ? '0' : '3px',
                        background: '#fff'
                      }}
                    >
                      <option value="all">All</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                </div>

                {/* Friends List */}
                <div style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                  background: '#fff',
                  padding: '4px'
                }}>
                  {friendsState.isLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px' }}>
                      Loading friends...
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: '#666' }}>
                      {searchQuery ? 'No friends found' : 'No friends yet'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {filteredFriends.map((friend) => (
                        <div
                          key={friend.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px',
                            border: currentTheme === 'win98' ? '1px solid #c0c0c0' : '1px solid #e0e0e0',
                            background: currentTheme === 'win98' ? '#f0f0f0' : '#f9f9f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                            <div style={{ position: 'relative' }}>
                              <img
                                src={friend.avatarUrl || '/default-avatar.png'}
                                alt={friend.displayName || friend.username}
                                style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: friend.status === 'online' ? '#00ff00' :
                                           friend.status === 'away' ? '#ffff00' :
                                           friend.status === 'busy' ? '#ff0000' : '#808080',
                                border: '1px solid #fff'
                              }} />
                            </div>
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: '11px', 
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {friend.displayName || friend.username}
                              </div>
                              <div style={{ fontSize: '9px', color: '#666', textTransform: 'capitalize' }}>
                                {friend.status}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '2px' }}>
                            <button
                              title="Send Message"
                              style={{
                                ...getButtonStyles('primary'),
                                width: '20px',
                                height: '20px',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <MessageCircle size={10} />
                            </button>
                            
                            <button
                              onClick={() => removeFriend(friend.id)}
                              title="Remove Friend"
                              style={{
                                ...getButtonStyles('danger'),
                                width: '20px',
                                height: '20px',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ ADD FRIENDS TAB */}
            {activeTab === 'add' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={addFriendQuery}
                    onChange={(e) => setAddFriendQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      fontSize: '11px',
                      border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                      borderRadius: currentTheme === 'win98' ? '0' : '3px',
                      background: '#fff'
                    }}
                  />
                </div>

                <div style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                  background: '#fff',
                  padding: '4px'
                }}>
                  {isSearchingUsers ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px' }}>
                      Searching...
                    </div>
                  ) : addFriendResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: '#666' }}>
                      {addFriendQuery ? 'No users found' : 'Enter a username to search'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {addFriendResults.map((user) => (
                        <div
                          key={user.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px',
                            border: currentTheme === 'win98' ? '1px solid #c0c0c0' : '1px solid #e0e0e0',
                            background: currentTheme === 'win98' ? '#f0f0f0' : '#f9f9f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                            <img
                              src={user.avatarUrl || '/default-avatar.png'}
                              alt={user.displayName || user.username}
                              style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                            />
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: '11px', 
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {user.displayName || user.username}
                              </div>
                              <div style={{ fontSize: '9px', color: '#666' }}>
                                @{user.username}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => sendFriendRequest(user.id)}
                            style={{
                              ...getButtonStyles('primary'),
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <UserPlus size={10} />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ FRIEND REQUESTS TAB */}
            {activeTab === 'requests' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                  background: '#fff',
                  padding: '4px'
                }}>
                  {friendsState.pendingRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: '#666' }}>
                      No pending requests
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {friendsState.pendingRequests.map((request) => (
                        <div
                          key={request.id}
                          style={{
                            padding: '6px',
                            border: currentTheme === 'win98' ? '1px solid #c0c0c0' : '1px solid #e0e0e0',
                            background: currentTheme === 'win98' ? '#f0f0f0' : '#f9f9f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <img
                              src={request.from.avatarUrl || '/default-avatar.png'}
                              alt={request.from.displayName || request.from.username}
                              style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                            />
                            
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                {request.from.displayName || request.from.username}
                              </div>
                              <div style={{ fontSize: '9px', color: '#666' }}>
                                {request.type === 'incoming' ? 'Sent you a friend request' : 'You sent a friend request'}
                              </div>
                              {request.message && (
                                <div style={{ fontSize: '9px', color: '#333', fontStyle: 'italic', marginTop: '2px' }}>
                                  "{request.message}"
                                </div>
                              )}
                            </div>
                          </div>

                          {request.type === 'incoming' && (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => acceptFriendRequest(request.id)}
                                style={{
                                  ...getButtonStyles('primary'),
                                  padding: '3px 8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <UserCheck size={10} />
                                <span>Accept</span>
                              </button>
                              <button
                                style={{
                                  ...getButtonStyles('secondary'),
                                  padding: '3px 8px'
                                }}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          
                          {request.type === 'outgoing' && (
                            <div style={{ textAlign: 'right', fontSize: '9px', color: '#666' }}>
                              Pending...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ BLOCKED USERS TAB */}
            {activeTab === 'blocked' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                  flex: 1, 
                  overflowY: 'auto',
                  border: currentTheme === 'win98' ? '1px inset #c0c0c0' : '1px solid #ccc',
                  background: '#fff',
                  padding: '4px'
                }}>
                  {friendsState.blockedUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: '#666' }}>
                      No blocked users
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {friendsState.blockedUsers.map((user) => (
                        <div
                          key={user.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px',
                            border: currentTheme === 'win98' ? '1px solid #c0c0c0' : '1px solid #e0e0e0',
                            background: currentTheme === 'win98' ? '#f0f0f0' : '#f9f9f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                            <img
                              src={user.avatarUrl || '/default-avatar.png'}
                              alt={user.displayName || user.username}
                              style={{ 
                                width: '24px', 
                                height: '24px', 
                                borderRadius: '50%',
                                filter: 'grayscale(100%)',
                                opacity: 0.7
                              }}
                            />
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontSize: '11px', 
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: '#666'
                              }}>
                                {user.displayName || user.username}
                              </div>
                              <div style={{ fontSize: '9px', color: '#999' }}>
                                Blocked user
                              </div>
                            </div>
                          </div>

                          <button
                            style={{
                              ...getButtonStyles('primary'),
                              padding: '4px 8px'
                            }}
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ ERROR MESSAGE */}
            {friendsState.error && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: currentTheme === 'win98' ? '#ffcccc' : '#fee',
                border: currentTheme === 'win98' ? '1px solid #ff0000' : '1px solid #fcc',
                padding: '8px',
                borderRadius: currentTheme === 'win98' ? '0' : '4px',
                fontSize: '11px',
                color: '#c00',
                maxWidth: '250px',
                textAlign: 'center',
                zIndex: 1000
              }}>
                {friendsState.error}
                <div style={{ marginTop: '4px' }}>
                  <button
                    onClick={() => setFriendsState(prev => ({ ...prev, error: null }))}
                    style={getButtonStyles('secondary')}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FriendsWindow;