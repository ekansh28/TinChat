// server/config/database-init.ts
import { logger } from '../utils/logger';
import { getXataClient } from './xata';

// Table creation queries
const INIT_QUERIES = [
  // 1. User Profiles
  `CREATE TABLE user_profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    pronouns TEXT,
    status TEXT DEFAULT 'offline',
    display_name_color TEXT DEFAULT '#667eea',
    display_name_animation TEXT DEFAULT 'none',
    rainbow_speed INTEGER DEFAULT 3,
    badges JSONB DEFAULT '[]'::jsonb,
    bio TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT FALSE,
    profile_complete BOOLEAN DEFAULT FALSE,
    profile_card_css TEXT,
    easy_customization_data JSONB DEFAULT '{}'::jsonb,
    blocked_users TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // 2. Friendships
  `CREATE TABLE friendships (
    id SERIAL PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    initiated_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_different_users CHECK (user1_id != user2_id),
    CONSTRAINT unq_friendship UNIQUE (user1_id, user2_id)
  )`,

  // 3. Friend Requests
  `CREATE TABLE friend_requests (
    id SERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_different_request_users CHECK (sender_id != receiver_id),
    CONSTRAINT unq_pending_request UNIQUE (sender_id, receiver_id)
  )`,

  // 4. Blocked Users
  `CREATE TABLE blocked_users (
    id SERIAL PRIMARY KEY,
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_different_block_users CHECK (blocker_id != blocked_id),
    CONSTRAINT unq_block UNIQUE (blocker_id, blocked_id)
  )`,

  // 5. Chat Messages
  `CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    read_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_different_message_users CHECK (sender_id != receiver_id)
  )`
];

// Index creation queries
const INDEX_QUERIES = [
  'CREATE INDEX idx_user_profiles_username ON user_profiles(username)',
  'CREATE INDEX idx_user_profiles_status ON user_profiles(status)',
  'CREATE INDEX idx_user_profiles_is_online ON user_profiles(is_online)',
  'CREATE INDEX idx_friendships_user1 ON friendships(user1_id)',
  'CREATE INDEX idx_friendships_user2 ON friendships(user2_id)',
  'CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id)',
  'CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id)',
  'CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id)',
  'CREATE INDEX idx_blocked_users_blocked ON blocked_users(blocked_id)',
  'CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id)',
  'CREATE INDEX idx_chat_messages_receiver ON chat_messages(receiver_id)',
  'CREATE INDEX idx_chat_messages_conversation ON chat_messages(sender_id, receiver_id, created_at)'
];

export async function initializeDatabaseTables(): Promise<boolean> {
  const xata = getXataClient();
  if (!xata) {
    logger.error('Xata client not initialized');
    return false;
  }

  try {
    logger.info('Starting database initialization...');

    // Create tables
    for (const query of INIT_QUERIES) {
      await xata.executeSQL(query);
    }
    logger.info('✅ Created all tables');

    // Create indexes
    for (const query of INDEX_QUERIES) {
      await xata.executeSQL(query);
    }
    logger.info('✅ Created all indexes');

    // Verify tables
    const verification = await xata.executeSQL(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_profiles', 'friendships', 'friend_requests', 'blocked_users', 'chat_messages')
      ORDER BY table_name
    `);

    logger.info('Database tables verification:', verification);
    logger.info('🎉 Database initialization completed successfully!');
    return true;

  } catch (error: any) {
    logger.error('❌ Database initialization failed:', error.message);
    return false;
  }
}