// server/config/supabase.ts - ENHANCED VERSION WITH ROBUST ERROR HANDLING

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
const RETRY_DELAY = 2000; // 2 seconds

/**
 * ✅ ENHANCED: Initialize Supabase with better error handling and retry logic
 */
export function initializeSupabase(): SupabaseClient | null {
  try {
    const config = getSupabaseConfig();
    
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      logger.error('❌ Supabase configuration missing - check environment variables');
      return null;
    }

    // ✅ ENHANCED: Create client with optimized configuration
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      global: {
        headers: {
          'User-Agent': 'TinChat-Server/1.0',
        },
        fetch: createEnhancedFetch(), // Add custom fetch here
      },
      db: {
        schema: 'public',
      }
    });

    globalSupabaseClient = supabase;
    logger.info('✅ Supabase client initialized successfully');
    
    return supabase;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * ✅ NEW: Create enhanced fetch function with retry logic and better error handling
 */
function createEnhancedFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    // Convert input to string for logging
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      
      try {
        // ✅ Add timeout to each request
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
          headers: {
            ...init?.headers,
            'Connection': 'keep-alive',
          },
        });

        clearTimeout(timeoutId);

        // ✅ Check for HTTP errors
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (attempt > 0) {
          logger.info(`✅ Supabase request succeeded on attempt ${attempt + 1}`);
        }

        return response;
      } catch (error: any) {
        lastError = error;
        
        // Clear timeout if it exists
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Log the error with context
        logger.error(`❌ Supabase request failed (attempt ${attempt + 1}/${maxRetries}):`, {
          url: url.replace(/\/rest\/v1.*/, '/rest/v1/[endpoint]'), // Hide sensitive parts
          error: error.message,
          code: error.code,
          name: error.name,
        });

        // Don't retry for certain types of errors
        if (error.name === 'AbortError') {
          logger.error(`⏰ Request timeout for ${url}`);
        } else if (error.message?.includes('NetworkError') || error.message?.includes('fetch failed')) {
          logger.error(`🌐 Network error for Supabase request: ${error.message}`);
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
          logger.info(`⏳ Retrying Supabase request in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If all retries failed, throw the last error
    logger.error(`💥 All Supabase request attempts failed after ${maxRetries} tries`);
    throw lastError || new Error('Unknown fetch error');
  };
}

/**
 * ✅ ENHANCED: Get Supabase configuration with validation
 */
function getSupabaseConfig(): SupabaseConfig {
  const config = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };

  // ✅ Validate URLs
  if (config.supabaseUrl && !config.supabaseUrl.startsWith('https://')) {
    logger.error('❌ Supabase URL must start with https://');
    config.supabaseUrl = undefined;
  }

  return config;
}

/**
 * ✅ ENHANCED: Test database connection with comprehensive health check
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
      
      // ✅ Test with a simple query that should always work
      const { data, error, status } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .maybeSingle();

      const latency = Date.now() - startTime;

      if (error) {
        // Handle specific error types
        if (error.code === 'PGRST116') {
          // No rows found - this is actually success for our test
          logger.info(`✅ Database connection test passed (no data, but connection works) - ${latency}ms`);
          return true;
        } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          logger.error(`❌ Database table 'user_profiles' does not exist. Please run migrations first.`);
          return false;
        } else {
          throw error;
        }
      }

      logger.info(`✅ Database connection test passed with data - ${latency}ms (attempt ${attempts})`);
      return true;

    } catch (error: any) {
      logger.error(`❌ Database connection test failed (attempt ${attempts}/${maxAttempts}):`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      // Check for specific error patterns
      if (error.message?.includes('fetch failed') || error.message?.includes('NetworkError')) {
        logger.error('🌐 Network connectivity issue detected');
      } else if (error.message?.includes('JWT')) {
        logger.error('🔑 Authentication issue - check your service role key');
        return false; // Don't retry auth errors
      } else if (error.message?.includes('timeout')) {
        logger.error('⏰ Database timeout - server may be overloaded');
      }

      // Don't retry for auth errors
      if (error.code === '401' || error.message?.includes('JWT')) {
        return false;
      }

      // Wait before retrying
      if (attempts < maxAttempts) {
        const delay = RETRY_DELAY * attempts;
        logger.info(`⏳ Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`💥 Database connection failed after ${maxAttempts} attempts`);
  return false;
}

/**
 * ✅ NEW: Get detailed database health information
 */
export async function getDatabaseHealth(supabase: SupabaseClient): Promise<DatabaseHealth> {
  const startTime = Date.now();
  let health: DatabaseHealth = {
    connected: false,
    latency: 0,
    connectionAttempts,
  };

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count', { count: 'exact', head: true });

    health.latency = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') {
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
 * ✅ NEW: Check if specific tables exist
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
        .limit(0)
        .maybeSingle();

      if (error && !error.message.includes('PGRST116')) {
        if (error.message.includes('does not exist')) {
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
 * ✅ NEW: Enhanced connection monitoring
 */
export function startConnectionMonitoring(supabase: SupabaseClient): void {
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;
  
  const monitor = async () => {
    try {
      const health = await getDatabaseHealth(supabase);
      
      if (health.connected) {
        if (consecutiveFailures > 0) {
          logger.info(`✅ Database connection restored after ${consecutiveFailures} failures`);
          consecutiveFailures = 0;
        }
        
        if (health.latency > 2000) {
          logger.warn(`⚠️ Slow database response: ${health.latency}ms`);
        }
      } else {
        consecutiveFailures++;
        logger.error(`❌ Database health check failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, health.error);
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logger.error('🚨 Database connection appears to be permanently down');
          // Could trigger alerts or failover logic here
        }
      }
    } catch (error) {
      consecutiveFailures++;
      logger.error('❌ Database monitoring error:', error);
    }
  };

  // Run health check every 2 minutes
  setInterval(monitor, 2 * 60 * 1000);
  
  // Run initial check after 30 seconds
  setTimeout(monitor, 30000);
  
  logger.info('📊 Database connection monitoring started');
}

/**
 * ✅ NEW: Get current Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  return globalSupabaseClient;
}

/**
 * ✅ NEW: Reinitialize Supabase connection
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
 * ✅ NEW: Create a connection health reporter
 */
export function createConnectionReporter() {
  return {
    getConnectionAttempts: () => connectionAttempts,
    getGlobalClient: () => globalSupabaseClient,
    
    async runDiagnostics(supabase: SupabaseClient) {
      logger.info('🔍 Running Supabase diagnostics...');
      
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
      }
      
      if (health.latency > 1000) {
        recommendations.push('Consider upgrading Supabase plan for better performance');
        recommendations.push('Check for slow queries in your application');
      }
      
      if (!tableCheck.allTablesExist) {
        recommendations.push(`Run database migrations - missing tables: ${tableCheck.missingTables.join(', ')}`);
      }
      
      if (connectionAttempts > 10) {
        recommendations.push('High number of connection attempts detected - check for connection leaks');
      }
      
      report.recommendations = recommendations;
      
      logger.info('📋 Supabase diagnostics complete:', report);
      return report;
    }
  };
}