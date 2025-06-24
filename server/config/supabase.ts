// server/config/supabase.ts - SIMPLIFIED VERSION WITHOUT COMPLEX FETCH

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
 * ✅ SIMPLIFIED: Initialize Supabase with minimal configuration
 */
export function initializeSupabase(): SupabaseClient | null {
  try {
    const config = getSupabaseConfig();
    
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      logger.error('❌ Supabase configuration missing - check environment variables');
      logger.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }

    // ✅ SIMPLIFIED: Use basic Supabase client without custom fetch
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public',
      },
      // ✅ REMOVED: Complex custom fetch that was causing 401 errors
      global: {
        headers: {
          'User-Agent': 'TinChat-Server/1.0',
        }
      }
    });

    globalSupabaseClient = supabase;
    logger.info('✅ Supabase client initialized successfully with simplified config');
    
    return supabase;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * ✅ SIMPLIFIED: Get Supabase configuration with basic validation
 */
function getSupabaseConfig(): SupabaseConfig {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };

  // ✅ Validate URLs
  if (config.supabaseUrl && !config.supabaseUrl.startsWith('https://')) {
    logger.error('❌ Supabase URL must start with https://');
    config.supabaseUrl = undefined;
  }

  // ✅ Log config status (without exposing keys)
  logger.info('🔧 Supabase Config Status:', {
    hasUrl: !!config.supabaseUrl,
    hasKey: !!config.supabaseServiceKey,
    urlPrefix: config.supabaseUrl?.substring(0, 30) + '...',
    keyPrefix: config.supabaseServiceKey?.substring(0, 20) + '...'
  });

  return config;
}

/**
 * ✅ SIMPLIFIED: Test database connection with basic query
 */
export async function testDatabaseConnection(supabase: SupabaseClient): Promise<boolean> {
  if (!supabase) {
    logger.error('❌ No Supabase client provided for connection test');
    return false;
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    connectionAttempts++;

    try {
      const startTime = Date.now();
      
      logger.info(`🔍 Testing database connection (attempt ${attempts}/${maxAttempts})...`);
      
      // ✅ SIMPLIFIED: Use basic select query without complex options
      const { data, error, status } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        logger.error(`❌ Database query error (attempt ${attempts}):`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status: status
        });

        // Check for specific error types
        if (error.code === '42P01') {
          logger.error('❌ Table "user_profiles" does not exist. Please run migrations first.');
          return false;
        } else if (error.message?.includes('JWT') || status === 401) {
          logger.error('❌ Authentication failed - check your service role key');
          return false;
        }

        // Don't retry for auth errors
        if (status === 401 || error.code === '401') {
          return false;
        }

        if (attempts < maxAttempts) {
          const delay = 2000 * attempts;
          logger.info(`⏳ Retrying database connection in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          return false;
        }
      }

      logger.info(`✅ Database connection test passed - ${latency}ms (attempt ${attempts})`);
      logger.info(`📊 Query returned ${data?.length || 0} records`);
      return true;

    } catch (error: any) {
      logger.error(`❌ Database connection test exception (attempt ${attempts}):`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      });

      // Check for specific error patterns
      if (error.message?.includes('fetch failed') || error.message?.includes('NetworkError')) {
        logger.error('🌐 Network connectivity issue detected');
      } else if (error.message?.includes('timeout')) {
        logger.error('⏰ Database timeout - server may be overloaded');
      }

      // Wait before retrying
      if (attempts < maxAttempts) {
        const delay = 2000 * attempts;
        logger.info(`⏳ Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`💥 Database connection failed after ${maxAttempts} attempts`);
  return false;
}

/**
 * ✅ SIMPLIFIED: Get basic database health information
 */
export async function getDatabaseHealth(supabase: SupabaseClient): Promise<DatabaseHealth> {
  const startTime = Date.now();
  let health: DatabaseHealth = {
    connected: false,
    latency: 0,
    connectionAttempts,
  };

  try {
    // ✅ SIMPLIFIED: Basic count query
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    health.latency = Date.now() - startTime;

    if (error) {
      health.error = `${error.code}: ${error.message}`;
      return health;
    }

    health.connected = true;
    logger.debug(`✅ Database health check passed: ${count} users, ${health.latency}ms`);
    return health;

  } catch (error: any) {
    health.latency = Date.now() - startTime;
    health.error = error.message || 'Unknown error';
    logger.error('❌ Database health check failed:', error);
    return health;
  }
}

/**
 * ✅ SIMPLIFIED: Check if required tables exist
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
      logger.debug(`🔍 Checking table: ${table}`);
      
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          missingTables.push(table);
          logger.warn(`❌ Missing table: ${table}`);
        } else {
          errors.push(`${table}: ${error.message}`);
          logger.error(`❌ Error checking ${table}:`, error);
        }
      } else {
        logger.debug(`✅ Table exists: ${table}`);
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        missingTables.push(table);
      } else {
        errors.push(`${table}: ${error.message}`);
      }
    }
  }

  const result = {
    allTablesExist: missingTables.length === 0,
    missingTables,
    errors,
  };

  logger.info('📋 Table check results:', result);
  return result;
}

/**
 * ✅ Get current Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  return globalSupabaseClient;
}

/**
 * ✅ SIMPLIFIED: Reinitialize Supabase connection
 */
export async function reinitializeSupabase(): Promise<SupabaseClient | null> {
  logger.info('🔄 Reinitializing Supabase connection...');
  
  globalSupabaseClient = null;
  connectionAttempts = 0;
  
  const supabase = initializeSupabase();
  
  if (supabase) {
    const isHealthy = await testDatabaseConnection(supabase);
    if (isHealthy) {
      logger.info('✅ Supabase reinitialization successful');
      return supabase;
    } else {
      logger.error('❌ Supabase reinitialization failed - connection test failed');
      return null;
    }
  }
  
  return null;
}

/**
 * ✅ SIMPLIFIED: Create a connection health reporter
 */
export function createConnectionReporter() {
  return {
    getConnectionAttempts: () => connectionAttempts,
    getGlobalClient: () => globalSupabaseClient,
    
    async runDiagnostics(supabase: SupabaseClient) {
      logger.info('🔍 Running simplified Supabase diagnostics...');
      
      const health = await getDatabaseHealth(supabase);
      const tableCheck = await checkRequiredTables(supabase);
      
      const report = {
        timestamp: new Date().toISOString(),
        health,
        tables: tableCheck,
        connectionAttempts,
        recommendations: [] as string[]
      };
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      if (!health.connected) {
        recommendations.push('Check network connectivity and Supabase service status');
        recommendations.push('Verify environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
        recommendations.push('Test connection manually with curl');
      }
      
      if (health.latency > 1000) {
        recommendations.push('High latency detected - check network or Supabase performance');
      }
      
      if (!tableCheck.allTablesExist) {
        recommendations.push(`Run database migrations - missing tables: ${tableCheck.missingTables.join(', ')}`);
      }
      
      if (connectionAttempts > 10) {
        recommendations.push('High number of connection attempts detected - check for connection issues');
      }
      
      report.recommendations = recommendations;
      
      logger.info('📋 Simplified Supabase diagnostics complete:', report);
      return report;
    }
  };
}