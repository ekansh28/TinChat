// src/app/chat/components/FriendsWindow.tsx

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Users, MessageCircle, Search, Filter, Settings, Trash2, UserX, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// ✅ FIXED: Import all interfaces from friends.ts
import {
  Friend,
  FriendRequest,
  FriendsWindowProps,
  FriendsState,
  ChatMessage,
  FriendsApiResponse,
  FriendRequestApiData, // ✅ Add this
  FriendRequestsApiResponse, // ✅ Add this
  UserStatus // ✅ Add this if not already imported
} from '../../../types/friends';
import { ExtendedChatMessage, isMessageFromSelf } from '../../../types/friendsExtended';

export const FriendsWindow: React.FC<FriendsWindowProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  // ✅ CRITICAL: Auto-use authentication (no manual auth required)
  const auth = useAuth();

  // ✅ NEW: Polling state management
  const [isPollingEnabled, setIsPollingEnabled] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // ✅ ENHANCED: loadFriendsData with polling support
  const loadFriendsData = useCallback(async (isPollUpdate = false) => {
    if (!auth.authId) {
      console.log('[FriendsWindow] ❌ No auth ID available');
      return;
    }

    // Don't show loading spinner for poll updates
    if (!isPollUpdate) {
      setFriendsState(prev => ({ ...prev, isLoading: true, error: null }));
    }
    
    try {
      if (isPollUpdate) {
        console.log('[FriendsWindow] 🔄 Polling for updates...');
      } else {
        console.log('[FriendsWindow] 📡 Loading friends data...');
      }
      
      // Load friends, requests, and blocked users in parallel
      const [friendsRes, requestsRes, blockedRes] = await Promise.all([
        fetch(`/api/friends/list?userId=${auth.authId}`),
        fetch(`/api/friends/request?userId=${auth.authId}`),
        fetch(`/api/friends/blocked?userId=${auth.authId}`)
      ]);

      const friendsData = friendsRes.ok ? await friendsRes.json() : { friends: [] };
      const requestsData = requestsRes.ok ? await requestsRes.json() : { requests: { received: [], sent: [] } };
      const blockedData = blockedRes.ok ? await blockedRes.json() : { blocked: [] };

      // ✅ FIXED: Transform nested requests structure to flat array
      const allRequests: FriendRequest[] = [];
      if (requestsData.requests) {
        // Add received requests with type indicator
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
        
        // Add sent requests with type indicator  
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
        pendingRequests: allRequests, // ✅ Now it's an array
        blockedUsers: blockedData.blocked || [],
        isLoading: false,
        error: null
      });

      console.log('[FriendsWindow] ✅ Friends data loaded:', {
        friends: friendsData.friends?.length || 0,
        requests: allRequests.length,
        blocked: blockedData.blocked?.length || 0,
        isPoll: isPollUpdate
      });

    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to load friends data:', error);
      if (!isPollUpdate) {
        setFriendsState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load friends data'
        }));
      }
    }
  }, [auth.authId]);

  // ✅ OPTION 1: Polling System - Auto-refresh every 10 seconds when requests tab is active
  useEffect(() => {
    if (!isOpen || !auth.authId || !isPollingEnabled) {
      // Clear existing poll interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    console.log('[FriendsWindow] 🔄 Starting polling for friend requests...');
    
    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      loadFriendsData(true); // Pass true to indicate this is a poll update
    }, 10000); // Poll every 10 seconds

    // Cleanup function
    return () => {
      if (pollIntervalRef.current) {
        console.log('[FriendsWindow] ⏹️ Stopping polling');
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, auth.authId, isPollingEnabled, loadFriendsData]);

  // ✅ Enable/disable polling based on active tab
  useEffect(() => {
    const shouldPoll = activeTab === 'requests';
    setIsPollingEnabled(shouldPoll);
    
    if (shouldPoll) {
      console.log('[FriendsWindow] 📡 Enabling polling for requests tab');
    } else {
      console.log('[FriendsWindow] ⏸️ Disabling polling');
    }
  }, [activeTab]);

  // ✅ OPTION 3: Page Visibility API - Refresh when page becomes visible
  useEffect(() => {
    if (!isOpen || !auth.authId) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[FriendsWindow] 👁️ Page became visible, refreshing data...');
        loadFriendsData(false); // Full refresh when page becomes visible
      } else {
        console.log('[FriendsWindow] 🙈 Page hidden');
      }
    };

    const handleFocus = () => {
      console.log('[FriendsWindow] 🔍 Window focused, checking for updates...');
      loadFriendsData(true); // Poll update when window gets focus
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isOpen, auth.authId, loadFriendsData]);

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
          // ✅ FIXED: Match the API route property names
          searchTerm: query.trim(), // Changed from 'query'
          currentUserAuthId: auth.authId, // Changed from 'currentUserId'
          limit: 20 // Optional but consistent
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
      const response = await fetch('/api/friends/request/send', { // ✅ Note: also check URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // ✅ FIXED: Match API route property names
          senderAuthId: auth.authId, // Changed from 'fromUserId'
          receiverAuthId: targetUserId, // Changed from 'toUserId'
          message: null // Optional message
        })
      });

      if (response.ok) {
        console.log('[FriendsWindow] ✅ Friend request sent');
        setAddFriendResults(prev => prev.filter(user => user.id !== targetUserId));
        loadFriendsData(); // Refresh data
      } else {
        const errorData = await response.json();
        console.error('[FriendsWindow] ❌ Friend request failed:', errorData.message);
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
        body: JSON.stringify({
          requestId,
          accepterAuthId: auth.authId // ✅ FIXED: Changed from 'userId'
        })
      });

      if (response.ok) {
        console.log('[FriendsWindow] ✅ Friend request accepted');
        loadFriendsData(); // Refresh data
      } else {
        const errorData = await response.json();
        console.error('[FriendsWindow] ❌ Accept failed:', errorData.message);
      }
    } catch (error) {
      console.error('[FriendsWindow] ❌ Failed to accept friend request:', error);
    }
  }, [auth.authId, loadFriendsData]);

  // In FriendsWindow.tsx
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
        console.log('[FriendsWindow] ✅ Friend removed');
        loadFriendsData(); // Refresh data
      } else {
        const errorData = await response.json();
        console.error('[FriendsWindow] ❌ Remove failed:', errorData.message);
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
          return friend.status === 'online' || friend.status === 'idle' || friend.status === 'dnd';
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
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        style={getWindowStyles()}
        className={className}
      >
        {/* ✅ TITLE BAR with theme styling */}
        <div style={getTitleBarStyles()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} />
            <span>Friends</span>
  
            
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: currentTheme === 'winxp' ? '#fff' : '#000',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
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
                {tab.icon && <UserPlus size={12} />}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{
              
                    color: '#000000',
                    borderRadius: '50%',
                    padding: '1px 4px',
                    fontSize: '8px',
                    marginLeft: '4px'
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ✅ CONTENT AREA */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
{/* ✅ FRIENDS TAB */}
{activeTab === 'friends' && (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    {/* Search and Filter */}
    <div style={{ padding: '8px', display: 'flex', gap: '4px' }}>
      <input
        type="text"
        placeholder="Search friends..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          flex: 1,
          padding: '4px',
          fontSize: '11px',
          border: currentTheme === 'win98' ? '1px inset ' : '1px solid ',
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
          border: currentTheme === 'win98' ? '1px inset' : '1px solid ',
          borderRadius: currentTheme === 'win98' ? '0' : '3px',
          background: '#fff'
        }}
      >
        <option value="all">All</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
      </select>
    </div>

    {/* Friends List */}
    
  <div style={{ flex: 1, overflow: 'auto',  margin: '2.4%', border: '2px inset ', background : '#ffffff76'  }}>
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 6px' }}>
      
      {friendsState.isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          Loading friends...
        </div>
      ) : filteredFriends.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
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
                padding: '6px',
                background: 'rgba(53, 53, 53, 0.37)',
                borderRadius: '2px',
                gap: '8px'
              }}
            >
              {/* ✅ ADDED: Avatar with status indicator */}
              <div style={{ position: 'relative' }}>
                <img
                  src={friend.avatar_url || friend.avatarUrl || '/default-avatar.png'}
                  alt=""
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    // Fallback to initials avatar
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,' + btoa(`
                      <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" fill="#4CAF50"/>
                        <text x="12" y="15" font-family="Arial" font-size="12" fill="white" text-anchor="middle">
                          ${(friend.display_name || friend.displayName || friend.username).charAt(0).toUpperCase()}
                        </text>
                      </svg>
                    `);
                  }}
                />
                
                {/* ✅ Status indicator with your preferred icons */}
                <img 
                  src={
                    friend.status === 'online' ? 'https://cdn.tinchat.online/icons/online.png' :
                    friend.status === 'idle' ? 'https://cdn.tinchat.online/icons/idle.png' :
                    friend.status === 'dnd' ? 'https://cdn.tinchat.online/icons/dnd.png' : 
                    'https://cdn.tinchat.online/icons/offline.png'
                  }
                  alt={`${friend.status} status`}
                  style={{
                    width: '8px',
                    height: '8px',
                    position: 'absolute',
                    bottom: '-1px',
                    right: '-1px',
                    borderRadius: '50%',
                    border: '1px solid #fff'
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                  {friend.display_name || friend.displayName || friend.username}
                </div>
                <div style={{ fontSize: '9px', color: '#666' }}>
                  {friend.status}
                </div>
              </div>
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
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
  </div>
)}


{/* ✅ ADD FRIENDS TAB */}
{activeTab === 'add' && (

  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    
    <div style={{ padding: '8px' }}>
      <input
        type="text"
        placeholder="Search for users..."
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
          
  <div style={{ flex: 1, overflow: 'auto',  margin: '2.4%', border: '2px inset ', background : '#ffffff76'  }}>

    <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
      {isSearchingUsers ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          Searching...
        </div>
      ) : addFriendResults.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          {addFriendQuery ? 'No users found' : 'Enter a username to search'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {addFriendResults.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px',
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '2px',
                gap: '8px'
              }}
            >
              {/* ✅ ADDED: Avatar display */}
              <img
                src={user.avatarUrl || user.avatar_url || '/default-avatar.png'}
                alt=""
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  // Fallback to initials if avatar fails to load
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" fill="#2196F3"/>
                      <text x="12" y="15" font-family="Arial" font-size="12" fill="white" text-anchor="middle">
                        ${(user.displayName || user.username).charAt(0).toUpperCase()}
                      </text>
                    </svg>
                  `);
                }}
              />
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                  {user.displayName || user.username}
                </div>
                <div style={{ fontSize: '9px', color: '#666' }}>
                  @{user.username}
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
                <UserPlus size={12} />
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
  </div>
)}

 {/* ✅ FRIEND REQUESTS TAB */}
{activeTab === 'requests' && (
        
  <div style={{ flex: 1, overflow: 'auto',  margin: '2.4%', border: '2px inset ', background : '#ffffff76'  }}>
  <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
    {friendsState.pendingRequests.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
        No pending requests
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {friendsState.pendingRequests.map((request) => (
          <div
            key={request.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              gap: '8px'
            }}
          >
            {/* ✅ ADDED: Avatar display */}
            <img
              src={request.from.avatarUrl || request.from.avatar_url || '/default-avatar.png'}
              alt=""
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                flexShrink: 0,
                objectFit: 'cover'
              }}
              onError={(e) => {
                // Fallback to initials if avatar fails to load
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,' + btoa(`
                  <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                    <rect width="32" height="32" fill="#4CAF50"/>
                    <text x="16" y="20" font-family="Arial" font-size="14" fill="white" text-anchor="middle">
                      ${(request.from.displayName || request.from.username).charAt(0).toUpperCase()}
                    </text>
                  </svg>
                `);
              }}
            />
            
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>
                {request.from.displayName || request.from.username}
              </div>
              <div style={{ fontSize: '10px', color: '#666' }}>
                {request.type === 'incoming' ? 'Sent you a friend request' : 'You sent a friend request'}
              </div>
              {request.message && (
                <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#888' }}>
                  "{request.message}"
                </div>
              )}
            </div>

            {request.type === 'incoming' && (
              <div style={{ display: 'flex', gap: '4px' }}>
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
                  <UserCheck size={12} />
                  Accept
                </button>
                <button
                  style={{
                    ...getButtonStyles('danger'),
                    padding: '3px 8px'
                  }}
                >
                  Decline
                </button>
              </div>
            )}

            {request.type === 'outgoing' && (
              <div style={{ fontSize: '10px', color: '#888' }}>
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
                    
  <div style={{ flex: 1, overflow: 'auto',  margin: '2.4%', border: '2px inset ', background : '#ffffff76'  }}>
              <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                {friendsState.blockedUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    No blocked users
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {friendsState.blockedUsers.map((user) => (
                      <div
                        key={user.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '6px',
                          background: 'rgba(255, 255, 255, 0.5)',
                          borderRadius: '2px',
                          gap: '8px'
                        }}
                      >
                        <div style={{ flex: 1, fontSize: '11px' }}>
                          {user.displayName || user.username}
                        </div>
                        <button
                          style={{
                            ...getButtonStyles('secondary'),
                            padding: '2px 6px'
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
                background: '#fff',
                border: '2px solid #ff0000',
                padding: '12px',
                borderRadius: '4px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                zIndex: 1000
              }}>
                <div style={{ marginBottom: '8px', color: '#d32f2f' }}>
                  {friendsState.error}
                </div>
                <button
                  onClick={() => setFriendsState(prev => ({ ...prev, error: null }))}
                  style={getButtonStyles('secondary')}
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FriendsWindow;
