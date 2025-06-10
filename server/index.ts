// server/index.ts - Simplified and Fixed Version
import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validation schemas
const StringArraySchema = z.array(z.string().max(100)).max(10);
const FindPartnerPayloadSchema = z.object({
  chatType: z.enum(['text', 'video']),
  interests: StringArraySchema,
  authId: z.string().uuid().nullable().optional().default(null),
});

const RoomIdPayloadSchema = z.object({
  roomId: z.string().regex(/^[a-zA-Z0-9#-_]+$/).max(100),
});

const SendMessagePayloadSchema = RoomIdPayloadSchema.extend({
  message: z.string().min(1).max(2000),
  username: z.string().max(30).nullable().optional(),
  authId: z.string().uuid().nullable().optional(),
});

const UpdateStatusPayloadSchema = z.object({
  status: z.enum(['online', 'idle', 'dnd', 'offline']),
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log('[SUPABASE] Client initialized successfully');
} else {
  console.warn('[SUPABASE] Missing credentials - profile features will be disabled');
}

// CORS configuration
const allowedOrigins = [
  "https://studio--chitchatconnect-aqa0w.us-central1.hosted.app",
  "https://delightful-pond-0cb3e0010.6.azurestaticapps.net", 
  "https://tinchat.online",
  "https://www.tinchat.online",
  "https://6000-idx-studio-1746229586647.cluster-73qgvk7hjjadkrjeyexca5ivva.cloudworkstations.dev",
  "http://localhost:9002",
  "http://localhost:3000",
  "http://localhost:3001"
];

// Development origins
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    "http://localhost:8080",
    "http://localhost:8000", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:9002"
  );
}

// Create HTTP server with CORS
const server = http.createServer((req, res) => {
  const requestOrigin = req.headers.origin;
  let originToAllow = undefined;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    originToAllow = requestOrigin;
  }

  if (originToAllow) {
    res.setHeader('Access-Control-Allow-Origin', originToAllow);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(originToAllow ? 204 : 403);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      onlineUserCount,
      waitingTextChat: waitingUsers.text.length,
      waitingVideoChat: waitingUsers.video.length,
      supabaseEnabled: !!supabase,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TinChat Socket.IO Server is running\n');
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS_DENIED] Origin - ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: false,
  serveClient: false,
});

// Global state
const socketToAuthId: { [socketId: string]: string } = {};
const authIdToSocketId: { [authId: string]: string } = {};
const waitingUsers: { text: any[], video: any[] } = { text: [], video: [] };
const rooms: { [roomId: string]: any } = {};
let onlineUserCount = 0;
const lastMatchRequest: { [socketId: string]: number } = {};
const FIND_PARTNER_COOLDOWN_MS = 2000;

// Utility functions
async function fetchUserProfile(authId: string): Promise<any> {
  if (!supabase || !authId) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        username, display_name, avatar_url, banner_url, pronouns, status,
        display_name_color, display_name_animation, rainbow_speed, badges
      `)
      .eq('id', authId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`[PROFILE_ERROR] Error fetching profile for ${authId}:`, error);
      }
      return null;
    }

    let parsedBadges = [];
    if (data.badges) {
      try {
        parsedBadges = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges;
        if (!Array.isArray(parsedBadges)) parsedBadges = [];
      } catch (e) {
        console.warn(`[BADGE_PARSE_ERROR] Failed to parse badges for ${authId}:`, e);
        parsedBadges = [];
      }
    }

    return { ...data, badges: parsedBadges };
  } catch (err) {
    console.error(`[PROFILE_EXCEPTION] Exception fetching profile for ${authId}:`, err);
    return null;
  }
}

async function updateUserStatus(authId: string, status: string): Promise<void> {
  if (!supabase || !authId) return;
  
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        status: status,
        last_seen: new Date().toISOString(),
        is_online: status === 'online'
      })
      .eq('id', authId);

    if (error) {
      console.error(`[STATUS_ERROR] Error updating status for ${authId}:`, error);
    } else {
      console.log(`[STATUS_UPDATE] Updated ${authId} status to ${status}`);
    }
  } catch (err) {
    console.error(`[STATUS_EXCEPTION] Exception updating status for ${authId}:`, err);
  }
}

function removeFromWaitingLists(socketId: string): void {
  ['text', 'video'].forEach(type => {
    const index = waitingUsers[type].findIndex(u => u.id === socketId);
    if (index !== -1) {
      waitingUsers[type].splice(index, 1);
      console.log(`[QUEUE_REMOVE] User ${socketId} removed from ${type} queue`);
    }
  });
}

function findMatch(currentUser: any): any {
  console.log(`[MATCH_START] Finding match for ${currentUser.id} (${currentUser.chatType})`);
  
  const queue = waitingUsers[currentUser.chatType];
  const candidates = queue.filter(p => p.id !== currentUser.id);
  
  if (candidates.length === 0) {
    console.log(`[MATCH_NO_CANDIDATES] No candidates for ${currentUser.id}`);
    return null;
  }

  let selectedPartner = null;

  // Interest-based matching
  if (currentUser.interests.length > 0) {
    for (const candidate of candidates) {
      const hasCommonInterest = candidate.interests.length > 0 &&
        candidate.interests.some((interest: string) => currentUser.interests.includes(interest));
      
      if (hasCommonInterest) {
        selectedPartner = candidate;
        console.log(`[MATCH_INTEREST] Interest match found: ${currentUser.id} ↔ ${candidate.id}`);
        break;
      }
    }
  }

  // Random matching if no interest match
  if (!selectedPartner && candidates.length > 0) {
    selectedPartner = candidates[Math.floor(Math.random() * candidates.length)];
    console.log(`[MATCH_RANDOM] Random match: ${currentUser.id} ↔ ${selectedPartner.id}`);
  }

  if (selectedPartner) {
    const index = waitingUsers[currentUser.chatType].findIndex(u => u.id === selectedPartner.id);
    if (index !== -1) {
      waitingUsers[currentUser.chatType].splice(index, 1);
      return selectedPartner;
    }
  }

  return null;
}

// Socket event handlers
io.on('connection', (socket) => {
  onlineUserCount++;
  console.log(`[CONNECT] User connected: ${socket.id}. Total: ${onlineUserCount}`);
  io.emit('onlineUserCountUpdate', onlineUserCount);

  socket.on('getOnlineUserCount', () => {
    socket.emit('onlineUserCount', onlineUserCount);
  });

  socket.on('updateStatus', async (payload) => {
    try {
      const { status } = UpdateStatusPayloadSchema.parse(payload);
      const authId = socketToAuthId[socket.id];
      
      if (authId) {
        await updateUserStatus(authId, status);
        
        // Broadcast to partner
        for (const roomId in rooms) {
          const room = rooms[roomId];
          if (room.users.includes(socket.id)) {
            const partnerId = room.users.find((id: string) => id !== socket.id);
            if (partnerId) {
              io.to(partnerId).emit('partnerStatusChanged', { status });
            }
            break;
          }
        }
        
        socket.emit('statusUpdated', { status });
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL] Invalid updateStatus from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for updateStatus.' });
    }
  });

  socket.on('findPartner', async (payload) => {
    try {
      const { chatType, interests, authId } = FindPartnerPayloadSchema.parse(payload);
      
      const now = Date.now();
      if (now - (lastMatchRequest[socket.id] || 0) < FIND_PARTNER_COOLDOWN_MS) {
        console.log(`[RATE_LIMIT] FindPartner cooldown for ${socket.id}`);
        socket.emit('findPartnerCooldown');
        return;
      }
      lastMatchRequest[socket.id] = now;

      console.log(`[FIND_PARTNER] ${socket.id} looking for ${chatType} chat. AuthID: ${authId || 'anonymous'}`);

      if (authId) {
        socketToAuthId[socket.id] = authId;
        authIdToSocketId[authId] = socket.id;
        await updateUserStatus(authId, 'online');
      }

      removeFromWaitingLists(socket.id);

      const currentUser: any = {
        id: socket.id,
        interests: interests || [],
        chatType,
        authId: authId || null
      };

      // Fetch profile if authenticated
      if (authId && supabase) {
        const profile = await fetchUserProfile(authId);
        if (profile) {
          currentUser.username = profile.username;
          currentUser.displayName = profile.display_name;
          currentUser.avatarUrl = profile.avatar_url;
          currentUser.bannerUrl = profile.banner_url;
          currentUser.pronouns = profile.pronouns;
          currentUser.status = profile.status || 'online';
          currentUser.displayNameColor = profile.display_name_color || '#ffffff';
          currentUser.displayNameAnimation = profile.display_name_animation || 'none';
          currentUser.rainbowSpeed = profile.rainbow_speed || 3;
          currentUser.badges = profile.badges || [];
        }
      }

      if (!currentUser.status) {
        currentUser.status = 'online';
        currentUser.displayNameColor = '#ffffff';
        currentUser.displayNameAnimation = 'none';
        currentUser.rainbowSpeed = 3;
        currentUser.badges = [];
      }

      const matchedPartner = findMatch(currentUser);

      if (matchedPartner) {
        const partnerSocket = io.sockets.sockets.get(matchedPartner.id);
        if (partnerSocket?.connected) {
          const roomId = `${currentUser.id}#${Date.now()}`;
          rooms[roomId] = { 
            id: roomId, 
            users: [currentUser.id, matchedPartner.id], 
            chatType 
          };

          socket.join(roomId);
          partnerSocket.join(roomId);

          const currentUserDisplayName = currentUser.displayName || currentUser.username || "Stranger";
          const partnerDisplayName = matchedPartner.displayName || matchedPartner.username || "Stranger";

          socket.emit('partnerFound', {
            partnerId: matchedPartner.id,
            roomId,
            interests: matchedPartner.interests,
            partnerUsername: partnerDisplayName,
            partnerDisplayName: matchedPartner.displayName,
            partnerAvatarUrl: matchedPartner.avatarUrl,
            partnerBannerUrl: matchedPartner.bannerUrl,
            partnerPronouns: matchedPartner.pronouns,
            partnerStatus: matchedPartner.status || 'online',
            partnerDisplayNameColor: matchedPartner.displayNameColor || '#ffffff',
            partnerDisplayNameAnimation: matchedPartner.displayNameAnimation || 'none',
            partnerRainbowSpeed: matchedPartner.rainbowSpeed || 3,
            partnerAuthId: matchedPartner.authId,
            partnerBadges: matchedPartner.badges || [],
          });

          partnerSocket.emit('partnerFound', {
            partnerId: currentUser.id,
            roomId,
            interests: currentUser.interests,
            partnerUsername: currentUserDisplayName,
            partnerDisplayName: currentUser.displayName,
            partnerAvatarUrl: currentUser.avatarUrl,
            partnerBannerUrl: currentUser.bannerUrl,
            partnerPronouns: currentUser.pronouns,
            partnerStatus: currentUser.status || 'online',
            partnerDisplayNameColor: currentUser.displayNameColor || '#ffffff',
            partnerDisplayNameAnimation: currentUser.displayNameAnimation || 'none',
            partnerRainbowSpeed: currentUser.rainbowSpeed || 3,
            partnerAuthId: currentUser.authId,
            partnerBadges: currentUser.badges || [],
          });

          console.log(`[MATCH_SUCCESS] Room ${roomId} created for ${currentUser.id} and ${matchedPartner.id}`);
        } else {
          console.warn(`[MATCH_FAIL] Partner ${matchedPartner.id} disconnected`);
          waitingUsers[currentUser.chatType].push(currentUser);
          socket.emit('waitingForPartner');
        }
      } else {
        waitingUsers[chatType].push(currentUser);
        console.log(`[WAITING] User ${socket.id} added to ${chatType} queue (size: ${waitingUsers[chatType].length})`);
        socket.emit('waitingForPartner');
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL] Invalid findPartner from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for findPartner.' });
    }
  });

  socket.on('sendMessage', async (payload) => {
    try {
      const { roomId, message, username, authId } = SendMessagePayloadSchema.parse(payload);
      
      const roomDetails = rooms[roomId];
      if (!roomDetails || !roomDetails.users.includes(socket.id)) {
        console.warn(`[MESSAGE_FAIL] User ${socket.id} not in room ${roomId}`);
        return;
      }

      let senderUsername = 'Stranger';
      let senderDisplayNameColor = '#ffffff';
      let senderDisplayNameAnimation = 'none';
      let senderRainbowSpeed = 3;

      if (authId) {
        if (username) {
          senderUsername = username;
        } else {
          const profile = await fetchUserProfile(authId);
          if (profile) {
            senderUsername = profile.display_name || profile.username || 'Stranger';
            senderDisplayNameColor = profile.display_name_color || '#ffffff';
            senderDisplayNameAnimation = profile.display_name_animation || 'none';
            senderRainbowSpeed = profile.rainbow_speed || 3;
          }
        }
      }

      const messagePayload = {
        senderId: socket.id,
        message,
        senderUsername,
        senderAuthId: authId || null,
        senderDisplayNameColor,
        senderDisplayNameAnimation,
        senderRainbowSpeed
      };

      const partnerId = roomDetails.users.find((id: string) => id !== socket.id);
      if (partnerId) {
        console.log(`[MESSAGE_RELAY] ${socket.id} → ${partnerId} in room ${roomId}`);
        io.to(partnerId).emit('receiveMessage', messagePayload);
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL] Invalid sendMessage from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for sendMessage.' });
    }
  });

  socket.on('typing_start', (payload) => {
    try {
      const { roomId } = RoomIdPayloadSchema.parse(payload);
      const roomDetails = rooms[roomId];
      if (roomDetails?.users.includes(socket.id)) {
        const partnerId = roomDetails.users.find((id: string) => id !== socket.id);
        if (partnerId) io.to(partnerId).emit('partner_typing_start');
      }
    } catch (error: any) {
      console.warn(`[TYPING_START_ERROR] Invalid payload from ${socket.id}:`, error.message);
    }
  });

  socket.on('typing_stop', (payload) => {
    try {
      const { roomId } = RoomIdPayloadSchema.parse(payload);
      const roomDetails = rooms[roomId];
      if (roomDetails?.users.includes(socket.id)) {
        const partnerId = roomDetails.users.find((id: string) => id !== socket.id);
        if (partnerId) io.to(partnerId).emit('partner_typing_stop');
      }
    } catch (error: any) {
      console.warn(`[TYPING_STOP_ERROR] Invalid payload from ${socket.id}:`, error.message);
    }
  });

  socket.on('leaveChat', (payload) => {
    try {
      const { roomId } = RoomIdPayloadSchema.parse(payload);
      
      if (rooms[roomId]?.users.includes(socket.id)) {
        const room = rooms[roomId];
        const partnerId = room.users.find((id: string) => id !== socket.id);
        
        socket.leave(roomId);
        if (partnerId) {
          io.to(partnerId).emit('partnerLeft');
          const partnerSocket = io.sockets.sockets.get(partnerId);
          if (partnerSocket) partnerSocket.leave(roomId);
        }
        
        delete rooms[roomId];
        console.log(`[LEAVE_CHAT] User ${socket.id} left room ${roomId}`);
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL] Invalid leaveChat from ${socket.id}:`, error.message);
      socket.emit('error', { message: 'Invalid payload for leaveChat.' });
    }
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[DISCONNECT] User ${socket.id} disconnected: ${reason}`);
    
    onlineUserCount = Math.max(0, onlineUserCount - 1);
    io.emit('onlineUserCountUpdate', onlineUserCount);
    
    removeFromWaitingLists(socket.id);
    delete lastMatchRequest[socket.id];
    
    const authId = socketToAuthId[socket.id];
    if (authId) {
      await updateUserStatus(authId, 'offline');
      delete socketToAuthId[socket.id];
      delete authIdToSocketId[authId];
    }
    
    // Clean up rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.users.includes(socket.id)) {
        const partnerId = room.users.find((id: string) => id !== socket.id);
        if (partnerId) {
          io.to(partnerId).emit('partnerLeft');
          const partnerSocket = io.sockets.sockets.get(partnerId);
          if (partnerSocket) partnerSocket.leave(roomId);
        }
        delete rooms[roomId];
        break;
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 TinChat Socket.IO Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Supabase: ${supabase ? 'enabled' : 'disabled'}`);
  console.log(`🌐 CORS origins: ${allowedOrigins.length} configured`);
});

// Periodic cleanup for inactive users
if (supabase) {
  setInterval(async () => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          status: 'offline',
          is_online: false 
        })
        .lt('last_seen', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .neq('status', 'offline');

      if (error) {
        console.error('[CLEANUP_ERROR] Error in periodic cleanup:', error);
      } else {
        console.log('[CLEANUP] Completed periodic user cleanup');
      }
    } catch (err) {
      console.error('[CLEANUP_EXCEPTION] Exception during cleanup:', err);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}