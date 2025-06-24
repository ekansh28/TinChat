// server/config/supabase.ts - COMPLETELY FIXED VERSION

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface SupabaseConfig {
  supabaseUrl: string | undefined;
  supabaseServiceKey: string | undefined;
}

interface DatabaseHealth {
  connected: boolean;
  latency: number;
  error?: string;
  connectionAttempts: number;
}

let globalSupabaseClient: SupabaseClient | null = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

/**
 * ✅ WORKING: Initialize Supabase with MINIMAL configuration (no custom fetch)
 */
export function initializeSupabase(): SupabaseClient | null {
  try {
    const config = getSupabaseConfig();
    
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      logger.error('❌ Supabase configuration missing - check environment variables');
      logger.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }

    // ✅ WORKING: Use BASIC Supabase client configuration ONLY
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public',
      }
      // ✅ CRITICAL: NO custom fetch, NO global headers - keep it simple
    });

    globalSupabaseClient = supabase;
    logger.info('✅ Supabase client initialized with BASIC configuration');
    
    return supabase;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * ✅ WORKING: Basic configuration getter
 */
function getSupabaseConfig(): SupabaseConfig {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };

  // ✅ Basic validation
  if (config.supabaseUrl && !config.supabaseUrl.startsWith('https://')) {
    logger.error('❌ Supabase URL must start with https://');
    config.supabaseUrl = undefined;
  }

  return config;
}

/**
 * ✅ WORKING: Simple database connection test
 */
export async function testDatabaseConnection(supabase: SupabaseClient): Promise<boolean> {
  if (!supabase) {
    logger.error('❌ No Supabase client provided for connection test');
    return false;
  }

  try {
    logger.info('🔍 Testing database connection...');
    
    // ✅ WORKING: Simple select query
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (error) {
      logger.error('❌ Database test failed:', {
        code: error.code,
        message: error.message
      });
      return false;
    }

    logger.info(`✅ Database test passed - found ${data?.length || 0} records`);
    return true;

  } catch (error: any) {
    logger.error('❌ Database test exception:', error.message);
    return false;
  }
}

/**
 * ✅ WORKING: Basic health check
 */
export async function getDatabaseHealth(supabase: SupabaseClient): Promise<DatabaseHealth> {
  const startTime = Date.now();
  let health: DatabaseHealth = {
    connected: false,
    latency: 0,
    connectionAttempts,
  };

  try {
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    health.latency = Date.now() - startTime;

    if (error) {
      health.error = `${error.code}: ${error.message}`;
      return health;
    }

    health.connected = true;
    return health;

  } catch (error: any) {
    health.latency = Date.now() - startTime;
    health.error = error.message || 'Unknown error';
    return health;
  }
}

/**
 * ✅ WORKING: Check if tables exist
 */
export async function checkRequiredTables(supabase: SupabaseClient): Promise<{
  allTablesExist: boolean;
  missingTables: string[];
  errors: string[];
}> {
  const requiredTables = ['user_profiles', 'friendships', 'friend_requests', 'blocked_users'];
  const missingTables: string[] = [];
  const errors: string[] = [];

  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          missingTables.push(table);
        } else {
          errors.push(`${table}: ${error.message}`);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        missingTables.push(table);
      } else {
        errors.push(`${table}: ${error.message}`);
      }
    }
  }

  return {
    allTablesExist: missingTables.length === 0,
    missingTables,
    errors,
  };
}

/**
 * ✅ Get current client
 */
export function getSupabaseClient(): SupabaseClient | null {
  return globalSupabaseClient;
}

/**
 * ✅ WORKING: Simple reinitialize
 */
export async function reinitializeSupabase(): Promise<SupabaseClient | null> {
  logger.info('🔄 Reinitializing Supabase...');
  
  globalSupabaseClient = null;
  connectionAttempts = 0;
  
  const supabase = initializeSupabase();
  
  if (supabase) {
    const isHealthy = await testDatabaseConnection(supabase);
    if (isHealthy) {
      logger.info('✅ Supabase reinitialization successful');
      return supabase;
    } else {
      logger.error('❌ Supabase reinitialization failed');
      return null;
    }
  }
  
  return null;
}

/**
 * ✅ WORKING: Simple diagnostics
 */
export function createConnectionReporter() {
  return {
    getConnectionAttempts: () => connectionAttempts,
    getGlobalClient: () => globalSupabaseClient,
    
    async runDiagnostics(supabase: SupabaseClient) {
      logger.info('🔍 Running basic Supabase diagnostics...');
      
      const health = await getDatabaseHealth(supabase);
      const tableCheck = await checkRequiredTables(supabase);
      
      const report = {
        timestamp: new Date().toISOString(),
        health,
        tables: tableCheck,
        connectionAttempts,
        recommendations: [] as string[]
      };
      
      // Basic recommendations
      if (!health.connected) {
        report.recommendations.push('Check network connectivity and Supabase service status');
        report.recommendations.push('Verify environment variables');
      }
      
      if (!tableCheck.allTablesExist) {
        report.recommendations.push(`Missing tables: ${tableCheck.missingTables.join(', ')}`);
      }
      
      logger.info('📋 Diagnostics complete:', report);
      return report;
    }
  };
}