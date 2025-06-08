import 'dotenv/config';  // Add this line at the very top
import http from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('[SUPABASE] Client initialized successfully');
} else {
  console.warn('[SUPABASE] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY - profile features will be disabled');
}

// Define allowed origins
const allowedOrigins = [
  "https://studio--chitchatconnect-aqa0w.us-central1.hosted.app",
  "https://delightful-pond-0cb3e0010.6.azurestaticapps.net",
  "https://tinchat.online",
  "https://www.tinchat.online",
  "https://6000-idx-studio-1746229586647.cluster-73qgvk7hjjadkrjeyexca5ivva.cloudworkstations.dev",
  "http://localhost:9002"
];

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    if (originToAllow) {
        res.writeHead(204);
    } else {
        res.writeHead(403);
    }
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      onlineUserCount: onlineUserCount,
      waitingTextChat: waitingUsers.text.length,
      waitingVideoChat: waitingUsers.video.length,
      supabaseEnabled: !!supabase
    }));
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Socket.IO Server is running and configured for CORS.\n');
  }
});

const io = new SocketIOServer(server, {
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
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Updated interfaces to include new profile features
interface User {
  id: string; // Socket ID
  authId: string | null; // Supabase auth user ID, can be null for anonymous users
  interests: string[];
  chatType: 'text' | 'video';
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pronouns?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  badges?: any[];
}

interface Room {
  id: string;
  users: string[]; // Socket IDs
  chatType: 'text' | 'video';
}

// Map socket IDs to auth user IDs for lookup
const socketToAuthId: { [socketId: string]: string } = {};
const authIdToSocketId: { [authId: string]: string } = {};

const waitingUsers: { [key in 'text' | 'video']: User[] } = {
  text: [],
  video: [],
};
const rooms: { [roomId: string]: Room } = {};
let onlineUserCount = 0;
const lastMatchRequest: { [socketId: string]: number } = {};
const FIND_PARTNER_COOLDOWN_MS = 2000; // 2 seconds

// Zod Schemas for input validation
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

const WebRTCSignalPayloadSchema = RoomIdPayloadSchema.extend({
  signalData: z.any(),
});

const UpdateStatusPayloadSchema = z.object({
  status: z.enum(['online', 'idle', 'dnd', 'offline']),
});

// Helper function to log queue state
function logQueueState(chatType: 'text' | 'video', context: string) {
  const queue = waitingUsers[chatType];
  console.log(`[QUEUE_STATE_${context.toUpperCase()}] ${chatType} queue (size: ${queue.length}):`, 
    queue.map(u => ({
      socketId: u.id,
      authId: u.authId || 'anonymous',
      interests: u.interests,
      username: u.username || 'no-username',
      status: u.status || 'offline',
      displayNameColor: u.displayNameColor || '#ffffff',
      displayNameAnimation: u.displayNameAnimation || 'none',
      badges: u.badges?.length || 0
    }))
  );
}

// FIXED: Enhanced helper function to fetch user profile with complete styling info and badges
async function fetchUserProfile(authId: string) {
  if (!supabase || !authId) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        username, 
        display_name, 
        avatar_url, 
        banner_url, 
        pronouns, 
        status, 
        display_name_color, 
        display_name_animation,
        rainbow_speed,
        badges
      `)
      .eq('id', authId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`[SUPABASE_ERROR] Error fetching profile for ${authId}:`, error);
      }
      return null;
    }
    
    // FIXED: Parse badges properly
    let parsedBadges = [];
    if (data.badges) {
      try {
        parsedBadges = JSON.parse(data.badges);
        if (!Array.isArray(parsedBadges)) {
          parsedBadges = [];
        }
      } catch (e) {
        console.warn(`[BADGE_PARSE_ERROR] Failed to parse badges for ${authId}:`, e);
        parsedBadges = [];
      }
    }
    
    return {
      ...data,
      badges: parsedBadges
    };
  } catch (err) {
    console.error(`[SUPABASE_EXCEPTION] Exception fetching profile for ${authId}:`, err);
    return null;
  }
}

// Helper function to update user status in database
async function updateUserStatus(authId: string, status: 'online' | 'idle' | 'dnd' | 'offline') {
  if (!supabase || !authId) return;
  
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        status: status,
        last_seen: new Date().toISOString()
      })
      .eq('id', authId);

    if (error) {
      console.error(`[SUPABASE_ERROR] Error updating status for ${authId}:`, error);
    } else {
      console.log(`[STATUS_UPDATE] Updated ${authId} status to ${status}`);
    }
  } catch (err) {
    console.error(`[SUPABASE_EXCEPTION] Exception updating status for ${authId}:`, err);
  }
}

function removeFromWaitingLists(socketId: string) {
  (['text', 'video'] as const).forEach(type => {
    const index = waitingUsers[type].findIndex(u => u.id === socketId);
    if (index !== -1) {
      waitingUsers[type].splice(index, 1);
      console.log(`[WAITING_LIST_REMOVE] User ${socketId} removed from ${type} waiting list.`);
      logQueueState(type, 'AFTER_REMOVE');
    }
  });
}

const findMatch = (currentUser: User): User | null => {
  console.log(`[MATCH_LOGIC_START] User ${currentUser.id} (authId: ${currentUser.authId || 'anonymous'}, interests: ${currentUser.interests.join(', ') || 'none'}) looking for ${currentUser.chatType} match.`);
  
  const queue = waitingUsers[currentUser.chatType];
  logQueueState(currentUser.chatType, 'MATCH_ATTEMPT');

  // Filter out self from candidates
  const candidates = queue.filter(p => p.id !== currentUser.id);
  console.log(`[MATCH_LOGIC_CANDIDATES] Available candidates for ${currentUser.id}: ${candidates.length}`);
  
  if (candidates.length === 0) {
    console.log(`[MATCH_LOGIC_NO_CANDIDATES] No candidates available for ${currentUser.id}`);
    return null;
  }

  let selectedPartner: User | null = null;

  // Try interest-based matching first if current user has interests
  if (currentUser.interests.length > 0) {
    console.log(`[MATCH_LOGIC_INTEREST_PHASE] User ${currentUser.id} has interests, attempting interest-based match.`);
    
    for (const potentialPartner of candidates) {
      console.log(`[MATCH_LOGIC_INTEREST_TRY] User ${currentUser.id} considering interest match with ${potentialPartner.id} (authId: ${potentialPartner.authId || 'anonymous'}, interests: ${potentialPartner.interests.join(', ') || 'none'}).`);

      const hasCommonInterest = potentialPartner.interests.length > 0 &&
                                potentialPartner.interests.some(interest => currentUser.interests.includes(interest));

      if (hasCommonInterest) {
        console.log(`[MATCH_LOGIC_INTEREST_COMMON_FOUND] Common interest found for ${currentUser.id} with ${potentialPartner.id}.`);
        selectedPartner = potentialPartner;
        break;
      } else {
        console.log(`[MATCH_LOGIC_INTEREST_NO_COMMON] No common interest for ${currentUser.id} with ${potentialPartner.id}.`);
      }
    }
    
    if (!selectedPartner) {
      console.log(`[MATCH_LOGIC_INTEREST_PHASE_END] No interest-based match for ${currentUser.id}. Proceeding to random match.`);
    }
  } else {
    console.log(`[MATCH_LOGIC_INTEREST_PHASE_SKIP] User ${currentUser.id} has no interests. Skipping interest-based match phase.`);
  }

  // Random matching if no interest match found or user has no interests
  if (!selectedPartner) {
    console.log(`[MATCH_LOGIC_RANDOM_PHASE] Random matching for ${currentUser.id} (candidates: ${candidates.length})`);
    
    if (candidates.length > 0) {
      // Shuffle candidates to make random matching more fair
      const shuffledCandidates = [...candidates];
      for (let i = shuffledCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCandidates[i], shuffledCandidates[j]] = [shuffledCandidates[j], shuffledCandidates[i]]; 
      }

      selectedPartner = shuffledCandidates[0];
      console.log(`[MATCH_LOGIC_RANDOM_SUCCESS] Random match selected: ${currentUser.id} with ${selectedPartner.id} (authId: ${selectedPartner.authId || 'anonymous'}).`);
    }
  }

  if (selectedPartner) {
    // Remove the selected partner from the waiting list
    const actualIndex = waitingUsers[currentUser.chatType].findIndex(u => u.id === selectedPartner.id);
    if (actualIndex !== -1) {
      const removedPartner = waitingUsers[currentUser.chatType].splice(actualIndex, 1)[0];
      console.log(`[MATCH_LOGIC_SUCCESS] Match found and partner removed from queue: ${currentUser.id} with ${removedPartner.id}.`);
      logQueueState(currentUser.chatType, 'AFTER_MATCH');
      return removedPartner;
    } else {
      console.log(`[MATCH_LOGIC_CONCURRENCY] Selected partner ${selectedPartner.id} was already removed from queue. No match possible.`);
    }
  }
  
  console.log(`[MATCH_LOGIC_NO_MATCH_END] No match found for ${currentUser.id} in ${currentUser.chatType} list.`);
  return null;
};

io.on('connection', (socket: Socket) => {
  onlineUserCount++;
  console.log(`[CONNECT] User connected: ${socket.id}. Total online: ${onlineUserCount}`);
  io.emit('onlineUserCountUpdate', onlineUserCount);

  socket.on('getOnlineUserCount', () => {
    socket.emit('onlineUserCount', onlineUserCount);
  });

  // New event handler for status updates
  socket.on('updateStatus', async (payload: unknown) => {
    try {
      const { status } = UpdateStatusPayloadSchema.parse(payload);
      const authId = socketToAuthId[socket.id];
      
      if (authId) {
        console.log(`[STATUS_UPDATE_REQUEST] User ${socket.id} (${authId}) updating status to: ${status}`);
        await updateUserStatus(authId, status);
        
        // Update status in current room if connected to partner
        for (const roomId in rooms) {
          const room = rooms[roomId];
          if (room.users.includes(socket.id)) {
            const partnerId = room.users.find(id => id !== socket.id);
            if (partnerId) {
              io.to(partnerId).emit('partnerStatusChanged', { status });
              console.log(`[STATUS_BROADCAST] Broadcasted status change to partner ${partnerId}`);
            }
            break;
          }
        }
        
        socket.emit('statusUpdated', { status });
      } else {
        console.warn(`[STATUS_UPDATE_FAIL] No auth ID found for socket ${socket.id}`);
        socket.emit('error', { message: 'Authentication required to update status.' });
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL_UPDATE_STATUS] Invalid updateStatus payload from ${socket.id}: ${error.errors ? JSON.stringify(error.errors) : error.message}`);
      socket.emit('error', { message: 'Invalid payload for updateStatus.' });
    }
  });

  socket.on('findPartner', async (payload: unknown) => {
    try {
      const validatedPayload = FindPartnerPayloadSchema.parse(payload);
      const { chatType, interests, authId } = validatedPayload;

      const now = Date.now();
      if (now - (lastMatchRequest[socket.id] || 0) < FIND_PARTNER_COOLDOWN_MS) {
        console.log(`[RATE_LIMIT_FIND_PARTNER] User ${socket.id} findPartner request ignored due to cooldown.`);
        socket.emit('findPartnerCooldown');
        return;
      }
      lastMatchRequest[socket.id] = now;

      console.log(`[FIND_PARTNER_REQUEST] User ${socket.id} (authId: ${authId || 'anonymous'}) looking for ${chatType} chat with interests: ${interests.join(', ') || 'none'}`);
      
      if (authId) {
        socketToAuthId[socket.id] = authId;
        authIdToSocketId[authId] = socket.id;
        // Set user status to online when finding partner
        await updateUserStatus(authId, 'online');
      }

      // Remove user from any existing waiting lists
      removeFromWaitingLists(socket.id);
      
      const currentUser: User = { 
        id: socket.id, 
        interests: interests || [], 
        chatType, 
        authId: authId || null 
      };
      
      // FIXED: Fetch enhanced profile if authenticated
      if (authId && supabase) {
        console.log(`[PROFILE_FETCH_ATTEMPT] Fetching enhanced profile for authId: ${authId}`);
        const profile = await fetchUserProfile(authId);
        if (profile) {
          currentUser.username = profile.username;
          currentUser.displayName = profile.display_name;
          currentUser.avatarUrl = profile.avatar_url;
          currentUser.bannerUrl = profile.banner_url;
          currentUser.pronouns = profile.pronouns;
          currentUser.status = profile.status || 'online';
          currentUser.displayNameColor = profile.display_name_color;
          currentUser.displayNameAnimation = profile.display_name_animation;
          currentUser.rainbowSpeed = profile.rainbow_speed;
          currentUser.badges = profile.badges || []; // FIXED: Include badges
          console.log(`[PROFILE_FETCH_SUCCESS] Fetched enhanced profile for ${authId}:`, {
            username: profile.username || 'null',
            displayName: profile.display_name || 'null',
            pronouns: profile.pronouns || 'null',
            status: profile.status || 'online',
            displayNameColor: profile.display_name_color || '#ffffff',
            displayNameAnimation: profile.display_name_animation || 'none',
            rainbowSpeed: profile.rainbow_speed || 3,
            badges: currentUser.badges?.length || 0
          });
        } else {
          console.log(`[PROFILE_FETCH_NO_PROFILE] No profile found or error for ${authId}.`);
          // Set default status for new users
          currentUser.status = 'online';
          currentUser.displayNameColor = '#ffffff';
          currentUser.displayNameAnimation = 'none';
          currentUser.rainbowSpeed = 3;
          currentUser.badges = [];
        }
      } else {
        console.log(`[PROFILE_FETCH_SKIP] Skipping profile fetch for anonymous user ${socket.id}`);
        currentUser.status = 'online';
        currentUser.displayNameColor = '#ffffff';
        currentUser.displayNameAnimation = 'none';
        currentUser.rainbowSpeed = 3;
        currentUser.badges = [];
      }

      // Log current queue state before attempting match
      logQueueState(chatType, 'BEFORE_MATCH');

      const matchedPartner = findMatch(currentUser);

      if (matchedPartner) {
        const partnerSocket = io.sockets.sockets.get(matchedPartner.id);
        if (partnerSocket && partnerSocket.connected) {
          const roomId = `${currentUser.id}#${Date.now()}`;
          rooms[roomId] = { id: roomId, users: [currentUser.id, matchedPartner.id], chatType };
          console.log(`[SERVER_ROOM_CREATED] Room ${roomId} created for users ${currentUser.id} and ${matchedPartner.id}.`);

          socket.join(roomId);
          partnerSocket.join(roomId);
          console.log(`[MATCH_SUCCESS] ${currentUser.id} and ${matchedPartner.id} joined room ${roomId}. Emitting 'partnerFound'.`);

          // Use display_name if available, fallback to username, then to "Stranger"
          const currentUserDisplayName = currentUser.displayName || currentUser.username || "Stranger";
          const partnerDisplayName = matchedPartner.displayName || matchedPartner.username || "Stranger";

          console.log(`[MATCH_SUCCESS_USERNAMES] Current user display name: "${currentUserDisplayName}", Partner display name: "${partnerDisplayName}"`);

          // FIXED: Enhanced partner found event with complete profile data including styling and badges
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
            partnerBadges: matchedPartner.badges || [], // FIXED: Include badges
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
            partnerBadges: currentUser.badges || [], // FIXED: Include badges
          });
        } else {
          console.warn(`[MATCH_FAIL_SOCKET_ISSUE] Partner ${matchedPartner.id} socket not found/disconnected. Re-queuing current user ${currentUser.id} and potential partner ${matchedPartner.id}.`);
          if (!waitingUsers[currentUser.chatType].some(user => user.id === currentUser.id)) {
              waitingUsers[currentUser.chatType].push(currentUser);
          }
          if (matchedPartner && !waitingUsers[matchedPartner.chatType].some(user => user.id === matchedPartner.id)) {
             waitingUsers[matchedPartner.chatType].unshift(matchedPartner);
          }
          socket.emit('waitingForPartner');
        }
      } else {
        // No match found, add user to waiting list
        if (!waitingUsers[chatType].some(user => user.id === socket.id)) {
          waitingUsers[chatType].push(currentUser);
        }
        console.log(`[WAITING_FOR_PARTNER] User ${socket.id} added to ${chatType} waiting list. Emitting 'waitingForPartner'. Current queue size: ${waitingUsers[chatType].length}`);
        logQueueState(chatType, 'AFTER_ADD_TO_QUEUE');
        socket.emit('waitingForPartner');
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL_FIND_PARTNER] Invalid findPartner payload from ${socket.id}: ${error.errors ? JSON.stringify(error.errors) : error.message}`);
      socket.emit('error', { message: 'Invalid payload for findPartner.' });
    }
  });

  socket.on('sendMessage', async (payload: unknown) => {
    try {
      const { roomId, message, username, authId } = SendMessagePayloadSchema.parse(payload);
      console.log(`[MESSAGE_RECEIVED_SERVER] User ${socket.id} (authId: ${authId || 'anonymous'}, username: ${username || 'none provided'}) sending message to room ${roomId}: "${message}"`);
      
      const roomDetails = rooms[roomId];
      if (!roomDetails) {
        console.warn(`[MESSAGE_WARN_SEND_FAIL] Room ${roomId} not found for message from ${socket.id}.`);
        return;
      }
      
      if (roomDetails.users.includes(socket.id)) {
        let senderUsernameToSend = 'Stranger';
        let senderDisplayNameColor = '#ffffff';
        let senderDisplayNameAnimation = 'none';
        let senderRainbowSpeed = 3;
        
        if (authId && username) {
          senderUsernameToSend = username;
          console.log(`[MESSAGE_AUTHENTICATED_USER] Using authenticated username: ${username}`);
          
          // FIXED: Fetch current profile data for display name styling - CRITICAL FOR COLOR SYNC
          const profile = await fetchUserProfile(authId);
          if (profile) {
            senderDisplayNameColor = profile.display_name_color || '#ffffff';
            senderDisplayNameAnimation = profile.display_name_animation || 'none';
            senderRainbowSpeed = profile.rainbow_speed || 3;
            console.log(`[MESSAGE_STYLE_INFO] Display name styling - Color: ${senderDisplayNameColor}, Animation: ${senderDisplayNameAnimation}, Rainbow Speed: ${senderRainbowSpeed}`);
          }
        } else if (authId && !username) {
          console.log(`[MESSAGE_FETCH_USERNAME] Authenticated user without username, fetching from database for authId: ${authId}`);
          const profile = await fetchUserProfile(authId);
          if (profile) {
            senderUsernameToSend = profile.display_name || profile.username || 'Stranger';
            senderDisplayNameColor = profile.display_name_color || '#ffffff';
            senderDisplayNameAnimation = profile.display_name_animation || 'none';
            senderRainbowSpeed = profile.rainbow_speed || 3;
            console.log(`[MESSAGE_FETCHED_USERNAME] Fetched username: ${senderUsernameToSend} with styling - Color: ${senderDisplayNameColor}, Animation: ${senderDisplayNameAnimation}`);
          }
        } else {
          console.log(`[MESSAGE_ANONYMOUS_USER] Anonymous user, using 'Stranger' with default styling`);
        }
        
        const messagePayload = { 
          senderId: socket.id, 
          message, 
          senderUsername: senderUsernameToSend,
          senderAuthId: authId || null,
          senderDisplayNameColor,
          senderDisplayNameAnimation,
          senderRainbowSpeed
        };
        
        const partnerId = roomDetails.users.find(id => id !== socket.id);
        if (partnerId) {
          console.log(`[MESSAGE_RELAY_DIRECT_IO_TO] Relaying message from ${socket.id} (${senderUsernameToSend}) to partner ${partnerId} in room ${roomId} with color ${senderDisplayNameColor}.`);
          io.to(partnerId).emit('receiveMessage', messagePayload);
        } else {
          console.warn(`[MESSAGE_WARN_RELAY_FAIL] No partner found in room ${roomId} for user ${socket.id}.`);
        }
      } else {
        console.warn(`[MESSAGE_WARN_SEND_FAIL] User ${socket.id} tried to send to room ${roomId} but not in it.`);
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL_SEND_MESSAGE] Invalid sendMessage payload from ${socket.id}: ${error.errors ? JSON.stringify(error.errors) : error.message}`);
      socket.emit('error', { message: 'Invalid payload for sendMessage.' });
    }
  });

  socket.on('webrtcSignal', (payload: unknown) => {
    try {
      const { roomId, signalData } = WebRTCSignalPayloadSchema.parse(payload);
      const roomDetails = rooms[roomId];
      if (roomDetails && roomDetails.users.includes(socket.id)) {
          const partnerId = roomDetails.users.find(id => id !== socket.id);
          if (partnerId) {
            io.to(partnerId).emit('webrtcSignal', signalData);
            console.log(`[WEBRTC_SIGNAL_SENT_IO_TO] Signal from ${socket.id} sent to ${partnerId} in room ${roomId}.`);
          } else {
            console.warn(`[WEBRTC_SIGNAL_WARN_FAIL] No partner in room ${roomId} for ${socket.id}.`);
          }
      } else {
          console.warn(`[WEBRTC_SIGNAL_WARN_FAIL] User ${socket.id} tried to send signal to room ${roomId} but not in room/room non-existent.`);
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL_WEBRTC_SIGNAL] Invalid webrtcSignal payload from ${socket.id}: ${error.errors ? JSON.stringify(error.errors) : error.message}`);
      socket.emit('error', { message: 'Invalid payload for webrtcSignal.' });
    }
  });

socket.on('typing_start', (payload: unknown) => {
  try {
    const { roomId } = RoomIdPayloadSchema.parse(payload);
    const roomDetails = rooms[roomId];
    if (roomDetails && roomDetails.users.includes(socket.id)) {
      const partnerId = roomDetails.users.find(id => id !== socket.id);
      if (partnerId) io.to(partnerId).emit('partner_typing_start');
    }
  } catch (error: any) {
    console.warn(`[TYPING_START_ERROR] Invalid typing_start payload from ${socket.id}: ${error.message}`);
  }
});


  socket.on('typing_stop', (payload: unknown) => {
    try {
      const { roomId } = RoomIdPayloadSchema.parse(payload);
      const roomDetails = rooms[roomId];
      if (roomDetails && roomDetails.users.includes(socket.id)) {
        const partnerId = roomDetails.users.find(id => id !== socket.id);
        if (partnerId) io.to(partnerId).emit('partner_typing_stop');
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL_TYPING_STOP] Invalid typing_stop payload from ${socket.id}: ${error.errors ? JSON.stringify(error.errors) : error.message}`);
    }
  });

  const cleanupUser = async (reason: string) => {
    console.log(`[CLEANUP_USER_INIT] User ${socket.id} cleaning up. Reason: ${reason}`);
    onlineUserCount = Math.max(0, onlineUserCount - 1);
    io.emit('onlineUserCountUpdate', onlineUserCount);
    removeFromWaitingLists(socket.id);
    delete lastMatchRequest[socket.id];

    const authId = socketToAuthId[socket.id];
    if (authId) {
      // Set user status to offline when disconnecting
      await updateUserStatus(authId, 'offline');
      delete socketToAuthId[socket.id];
      delete authIdToSocketId[authId];
    }

    for (const roomIdInLoop in rooms) {
        if (rooms.hasOwnProperty(roomIdInLoop)) {
            const room = rooms[roomIdInLoop];
            if (room.users.includes(socket.id)) {
                console.log(`[CLEANUP_USER_IN_ROOM] User ${socket.id} was in room ${room.id}.`);
                const partnerId = room.users.find(id => id !== socket.id);
                if (partnerId) {
                    console.log(`[CLEANUP_USER_EMIT_PARTNER_LEFT_IO_TO] Emitting 'partnerLeft' to ${partnerId} for room ${room.id}.`);
                    io.to(partnerId).emit('partnerLeft');
                    const partnerSocket = io.sockets.sockets.get(partnerId);
                    if (partnerSocket) partnerSocket.leave(room.id);
                }
                delete rooms[room.id];
                console.log(`[CLEANUP_USER_ROOM_DELETED] Room ${room.id} deleted.`);
                break; 
            }
        }
    }
    console.log(`[CLEANUP_USER_COMPLETE] Finished for ${socket.id}.`);
  };

  socket.on('leaveChat', (payload: unknown) => {
    try {
      const { roomId } = RoomIdPayloadSchema.parse(payload);
      console.log(`[LEAVE_CHAT_REQUEST] User ${socket.id} requests to leave room ${roomId}`);
      if (rooms[roomId] && rooms[roomId].users.includes(socket.id)) {
          const room = rooms[roomId];
          const partnerId = room.users.find(id => id !== socket.id);
          socket.leave(roomId);
          if (partnerId) {
              io.to(partnerId).emit('partnerLeft');
              const partnerSocket = io.sockets.sockets.get(partnerId);
              if (partnerSocket) partnerSocket.leave(roomId);
          }
          delete rooms[roomId];
          console.log(`[LEAVE_CHAT_SUCCESS_ROOM_DELETED] User ${socket.id} left room ${roomId}. Room deleted.`);
      } else {
          console.warn(`[LEAVE_CHAT_WARN_INVALID_REQUEST] User ${socket.id} tried to leave room ${roomId} but not found or user not in it.`);
      }
    } catch (error: any) {
      console.warn(`[VALIDATION_FAIL_LEAVE_CHAT] Invalid leaveChat payload from ${socket.id}: ${error.errors ? JSON.stringify(error.errors) : error.message}`);
      socket.emit('error', { message: 'Invalid payload for leaveChat.' });
    }
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[DISCONNECT_EVENT] User ${socket.id} disconnected. Reason: ${reason}`);
    await cleanupUser(`socket.io disconnect event: ${reason}`);
  });
});

// Periodic cleanup function to set inactive users offline
setInterval(async () => {
  if (supabase) {
    try {
      const { error } = await supabase.rpc('set_inactive_users_offline');
      if (error) {
        console.error('[PERIODIC_CLEANUP] Error setting inactive users offline:', error);
      } else {
        console.log('[PERIODIC_CLEANUP] Successfully checked for inactive users');
      }
    } catch (err) {
      console.error('[PERIODIC_CLEANUP] Exception during inactive user cleanup:', err);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

server.listen(PORT, () => {
  console.log(`[SERVER_START] Socket.IO server running on port ::: ${PORT}`);
  if (!supabase) {
    console.warn('[SERVER_START] Running without Supabase integration - profiles will not be loaded');
  }

});

export {};