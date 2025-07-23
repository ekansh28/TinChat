// src/app/chat/hooks/useFriendsSocket.ts - Socket.IO Integration for Friends
import { useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
  lastMessage?: {
    text: string;
    timestamp: Date;
    isFromSelf: boolean;
  };
}

interface ChatMessage {
  id: string;
  friendId: string;
  text: string;
  isFromSelf: boolean;
  timestamp: Date;
}

interface FriendsSocketHandlers {
  onFriendStatusChange: (friendId: string, isOnline: boolean) => void;
  onFriendMessage: (message: ChatMessage) => void;
  onFriendTypingStart: (friendId: string) => void;
  onFriendTypingStop: (friendId: string) => void;
  onFriendsListUpdate: (friends: Friend[]) => void;
}

export const useFriendsSocket = (
  socket: Socket | null,
  handlers: FriendsSocketHandlers
) => {
  const handlersRef = useRef(handlers);
  
  // Update handlers without recreating socket listeners
  handlersRef.current = handlers;

  // Setup friends-specific socket events
  useEffect(() => {
    if (!socket) return;

    console.log('[FriendsSocket] Setting up friends event listeners');

    // Friend status changes (online/offline)
    const handleFriendStatusChange = (data: { friendId: string; isOnline: boolean }) => {
      console.log('[FriendsSocket] Friend status change:', data);
      handlersRef.current.onFriendStatusChange(data.friendId, data.isOnline);
    };

    // Incoming friend messages
    const handleFriendMessage = (data: {
      messageId: string;
      fromFriendId: string;
      text: string;
      timestamp: string;
    }) => {
      console.log('[FriendsSocket] Friend message received:', data);
      
      const message: ChatMessage = {
        id: data.messageId,
        friendId: data.fromFriendId,
        text: data.text,
        isFromSelf: false,
        timestamp: new Date(data.timestamp)
      };
      
      handlersRef.current.onFriendMessage(message);
    };

    // Friend typing indicators
    const handleFriendTypingStart = (data: { friendId: string }) => {
      console.log('[FriendsSocket] Friend started typing:', data);
      handlersRef.current.onFriendTypingStart(data.friendId);
    };

    const handleFriendTypingStop = (data: { friendId: string }) => {
      console.log('[FriendsSocket] Friend stopped typing:', data);
      handlersRef.current.onFriendTypingStop(data.friendId);
    };

    // Friends list updates
    const handleFriendsListUpdate = (data: { friends: Friend[] }) => {
      console.log('[FriendsSocket] Friends list updated:', data);
      handlersRef.current.onFriendsListUpdate(data.friends);
    };

    // Register event listeners
    socket.on('friend_status_change', handleFriendStatusChange);
    socket.on('friend_message', handleFriendMessage);
    socket.on('friend_typing_start', handleFriendTypingStart);
    socket.on('friend_typing_stop', handleFriendTypingStop);
    socket.on('friends_list_update', handleFriendsListUpdate);

    // Cleanup function
    return () => {
      socket.off('friend_status_change', handleFriendStatusChange);
      socket.off('friend_message', handleFriendMessage);
      socket.off('friend_typing_start', handleFriendTypingStart);
      socket.off('friend_typing_stop', handleFriendTypingStop);
      socket.off('friends_list_update', handleFriendsListUpdate);
      console.log('[FriendsSocket] Cleaned up friends event listeners');
    };
  }, [socket]);

  // Emit functions for friends interactions
  const emitSendFriendMessage = useCallback((friendId: string, message: string) => {
    if (!socket?.connected) {
      console.warn('[FriendsSocket] Cannot send message - socket not connected');
      return false;
    }

    try {
      const messageData = {
        toFriendId: friendId,
        text: message,
        timestamp: new Date().toISOString(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      socket.emit('send_friend_message', messageData);
      console.log('[FriendsSocket] Sent friend message:', messageData);
      return true;
    } catch (error) {
      console.error('[FriendsSocket] Error sending friend message:', error);
      return false;
    }
  }, [socket]);

  const emitFriendTypingStart = useCallback((friendId: string) => {
    if (!socket?.connected) return false;

    try {
      socket.emit('friend_typing_start', { toFriendId: friendId });
      console.log('[FriendsSocket] Sent typing start to:', friendId);
      return true;
    } catch (error) {
      console.error('[FriendsSocket] Error sending typing start:', error);
      return false;
    }
  }, [socket]);

  const emitFriendTypingStop = useCallback((friendId: string) => {
    if (!socket?.connected) return false;

    try {
      socket.emit('friend_typing_stop', { toFriendId: friendId });
      console.log('[FriendsSocket] Sent typing stop to:', friendId);
      return true;
    } catch (error) {
      console.error('[FriendsSocket] Error sending typing stop:', error);
      return false;
    }
  }, [socket]);

  const emitRequestFriendsList = useCallback(() => {
    if (!socket?.connected) return false;

    try {
      socket.emit('request_friends_list');
      console.log('[FriendsSocket] Requested friends list');
      return true;
    } catch (error) {
      console.error('[FriendsSocket] Error requesting friends list:', error);
      return false;
    }
  }, [socket]);

  const emitJoinFriendsRoom = useCallback((authId: string) => {
    if (!socket?.connected) return false;

    try {
      socket.emit('join_friends_room', { authId });
      console.log('[FriendsSocket] Joined friends room for:', authId);
      return true;
    } catch (error) {
      console.error('[FriendsSocket] Error joining friends room:', error);
      return false;
    }
  }, [socket]);

  const emitLeaveFriendsRoom = useCallback(() => {
    if (!socket?.connected) return false;

    try {
      socket.emit('leave_friends_room');
      console.log('[FriendsSocket] Left friends room');
      return true;
    } catch (error) {
      console.error('[FriendsSocket] Error leaving friends room:', error);
      return false;
    }
  }, [socket]);

  return {
    // Emit functions
    emitSendFriendMessage,
    emitFriendTypingStart,
    emitFriendTypingStop,
    emitRequestFriendsList,
    emitJoinFriendsRoom,
    emitLeaveFriendsRoom,
    
    // Connection status
    isConnected: socket?.connected || false,
  };
};

// Example usage in TaskBar component:
/*
import { useFriendsSocket } from './hooks/useFriendsSocket';

export const TaskBar: React.FC = () => {
  // ... existing state

  const [friends, setFriends] = useState<Friend[]>([]);
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [typingFriends, setTypingFriends] = useState<Set<string>>(new Set());

  // Socket handlers for friends
  const friendsSocketHandlers = {
    onFriendStatusChange: (friendId: string, isOnline: boolean) => {
      setFriends(prev => prev.map(friend => 
        friend.id === friendId ? { ...friend, isOnline } : friend
      ));
    },
    
    onFriendMessage: (message: ChatMessage) => {
      // Add to chat messages
      setOpenChats(prev => prev.map(chat => {
        if (chat.friendId === message.friendId) {
          return {
            ...chat,
            messages: [...chat.messages, message]
          };
        }
        return chat;
      }));
      
      // Update friend's last message
      setFriends(prev => prev.map(friend => {
        if (friend.id === message.friendId) {
          return {
            ...friend,
            lastMessage: {
              text: message.text,
              timestamp: message.timestamp,
              isFromSelf: false
            }
          };
        }
        return friend;
      }));
      
      // Play notification sound
      try {
        const audioManager = getAudioManager();
        audioManager.playMessageReceived();
      } catch (error) {
        console.warn('Failed to play message sound:', error);
      }
    },
    
    onFriendTypingStart: (friendId: string) => {
      setTypingFriends(prev => new Set([...prev, friendId]));
    },
    
    onFriendTypingStop: (friendId: string) => {
      setTypingFriends(prev => {
        const newSet = new Set(prev);
        newSet.delete(friendId);
        return newSet;
      });
    },
    
    onFriendsListUpdate: (updatedFriends: Friend[]) => {
      setFriends(updatedFriends);
    }
  };

  // Initialize friends socket
  const friendsSocket = useFriendsSocket(socket, friendsSocketHandlers);

  // Join friends room when authenticated
  useEffect(() => {
    if (auth.authId && friendsSocket.isConnected) {
      friendsSocket.emitJoinFriendsRoom(auth.authId);
      friendsSocket.emitRequestFriendsList();
    }
  }, [auth.authId, friendsSocket.isConnected]);

  // Handle sending messages
  const handleSendMessage = useCallback((friendId: string, message: string) => {
    const success = friendsSocket.emitSendFriendMessage(friendId, message);
    
    if (success) {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        friendId,
        text: message,
        isFromSelf: true,
        timestamp: new Date()
      };

      // Add to local state immediately for better UX
      setOpenChats(prev => prev.map(chat => {
        if (chat.friendId === friendId) {
          return {
            ...chat,
            messages: [...chat.messages, newMessage]
          };
        }
        return chat;
      }));

      // Update friend's last message
      setFriends(prev => prev.map(friend => {
        if (friend.id === friendId) {
          return {
            ...friend,
            lastMessage: {
              text: message,
              timestamp: new Date(),
              isFromSelf: true
            }
          };
        }
        return friend;
      }));

      // Play send sound
      try {
        const audioManager = getAudioManager();
        audioManager.playMessageSent();
      } catch (error) {
        console.warn('Failed to play send sound:', error);
      }
    }
  }, [friendsSocket]);

  // ... rest of component
};
*/

// Server-side Socket.IO event handlers (for reference):
/*
// server/managers/modules/FriendsSocketHandler.ts
export class FriendsSocketHandler {
  constructor(
    private io: SocketIOServer,
    private profileManager: ProfileManager,
    private redisService: RedisService | null
  ) {}

  setupFriendsEvents(socket: Socket): void {
    // Join user to their friends room
    socket.on('join_friends_room', async (data: { authId: string }) => {
      const friendsRoom = `friends:${data.authId}`;
      await socket.join(friendsRoom);
      
      // Update user's online status
      await this.profileManager.updateUserStatus(data.authId, 'online');
      
      // Notify friends that user is online
      const friends = await this.profileManager.fetchUserFriends(data.authId);
      friends.forEach(friend => {
        socket.to(`friends:${friend.id}`).emit('friend_status_change', {
          friendId: data.authId,
          isOnline: true
        });
      });
    });

    // Send message to friend
    socket.on('send_friend_message', async (data: {
      toFriendId: string;
      text: string;
      timestamp: string;
      messageId: string;
    }) => {
      // Store message in database
      // ... message storage logic
      
      // Send to recipient
      socket.to(`friends:${data.toFriendId}`).emit('friend_message', {
        messageId: data.messageId,
        fromFriendId: socket.data.authId,
        text: data.text,
        timestamp: data.timestamp
      });
    });

    // Typing indicators
    socket.on('friend_typing_start', (data: { toFriendId: string }) => {
      socket.to(`friends:${data.toFriendId}`).emit('friend_typing_start', {
        friendId: socket.data.authId
      });
    });

    socket.on('friend_typing_stop', (data: { toFriendId: string }) => {
      socket.to(`friends:${data.toFriendId}`).emit('friend_typing_stop', {
        friendId: socket.data.authId
      });
    });

    // Request friends list
    socket.on('request_friends_list', async () => {
      const authId = socket.data.authId;
      if (authId) {
        const friends = await this.profileManager.fetchUserFriends(authId);
        socket.emit('friends_list_update', { friends });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const authId = socket.data.authId;
      if (authId) {
        await this.profileManager.updateUserStatus(authId, 'offline');
        
        // Notify friends that user went offline
        const friends = await this.profileManager.fetchUserFriends(authId);
        friends.forEach(friend => {
          socket.to(`friends:${friend.id}`).emit('friend_status_change', {
            friendId: authId,
            isOnline: false
          });
        });
      }
    });
  }
}
*/