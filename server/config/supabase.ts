// server/config/supabase.ts - FIXED VERSION WITH SSL/TLS HANDLING
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { Agent } from 'undici';

let supabaseClient: SupabaseClient | null = null;

// ✅ FIXED: Create custom agent to handle SSL issues in development
function createCustomFetchAgent() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // In production, use default secure settings
    return undefined;
  }
  
  // ✅ In development, create agent that can handle SSL issues
  try {
    const agent = new Agent({
      connect: {
        // ✅ For development only - handle SSL certificate issues
        rejectUnauthorized: false,
        // ✅ Additional SSL/TLS options for compatibility
        secureProtocol: 'TLS_method',
        ciphers: 'ALL',
      }
    });
    
    logger.info('🔒 Created custom SSL agent for development (rejectUnauthorized: false)');
    return agent;
  } catch (error) {
    logger.warn('⚠️ Failed to create custom SSL agent, using default:', error);
    return undefined;
  }
}

// ✅ FIXED: Custom fetch function with SSL handling
function createCustomFetch() {
  const agent = createCustomFetchAgent();
  
  if (!agent) {
    // Use default fetch if no custom agent
    return undefined;
  }
  
  // ✅ Create custom fetch function with undici agent
  return async (url: string | URL | Request, options: RequestInit = {}) => {
    try {
      // ✅ Use the custom agent for fetch requests
      const fetchOptions = {
        ...options,
        dispatcher: agent
      };
      
      return await fetch(url, fetchOptions);
    } catch (error: any) {
      // ✅ Enhanced error logging for SSL issues
      if (error.message?.includes('certificate') || error.message?.includes('SSL') || error.message?.includes('TLS')) {
        logger.error('🔒 SSL/TLS error in custom fetch:', {
          url: typeof url === 'string' ? url : url.toString(),
          error: error.message,
          code: error.code,
          cause: error.cause?.message
        });
      }
      throw error;
    }
  };
}

export function initializeSupabase(): SupabaseClient | null {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('❌ Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        nodeEnv: process.env.NODE_ENV
      });
      
      logger.info('📋 Required environment variables:');
      logger.info('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
      logger.info('   - SUPABASE_SERVICE_ROLE_KEY');
      
      return null;
    }

    // ✅ FIXED: Create server-side client with SSL handling and proper config
    const customFetch = createCustomFetch();
    
    const clientOptions: any = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
      // ✅ CRITICAL: Disable realtime for server usage
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    };
    
    // ✅ Add custom fetch if available (for SSL handling)
    if (customFetch) {
      clientOptions.global.fetch = customFetch;
      logger.info('🔒 Using custom fetch with SSL handling for development');
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, clientOptions);

    logger.info('✅ Supabase client initialized successfully with service role');
    logger.info(`📡 Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
    logger.info(`🔑 Service key configured: ${supabaseServiceKey.substring(0, 20)}...`);
    logger.info(`🔒 SSL handling: ${customFetch ? 'Custom agent (dev)' : 'Default (prod)'}`);
    
    return supabaseClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
}

export async function testDatabaseConnection(supabase: SupabaseClient | null): Promise<boolean> {
  if (!supabase) {
    logger.warn('⚠️ No Supabase client available for testing');
    return false;
  }

  try {
    logger.info('🔍 Testing Supabase database connection...');
    
    // ✅ ENHANCED: Multiple connection attempts with different strategies
    const strategies = [
      // Strategy 1: Simple select with minimal data
      async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
        return { data, error, strategy: 'simple-select' };
      },
      
      // Strategy 2: Count query (sometimes works when select fails)
      async () => {
        const { count, error } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })
          .limit(1);
        return { data: count !== null ? [{ count }] : null, error, strategy: 'count-query' };
      },
      
      // Strategy 3: Raw RPC call (lowest level)
      async () => {
        const { data, error } = await supabase
          .rpc('get_current_timestamp');
        return { data, error, strategy: 'rpc-call' };
      }
    ];
    
    let lastError = null;
    
    for (const [index, strategy] of strategies.entries()) {
      try {
        const startTime = Date.now();
        logger.debug(`🔄 Trying connection strategy ${index + 1}...`);
        
        const result = await strategy();
        const queryTime = Date.now() - startTime;

        if (result.error) {
          logger.warn(`⚠️ Strategy ${index + 1} (${result.strategy}) failed:`, {
            message: result.error.message,
            code: result.error.code,
            hint: result.error.hint
          });
          lastError = result.error;
          continue; // Try next strategy
        }

        logger.info(`✅ Database connection test successful using ${result.strategy} (${queryTime}ms)`);
        logger.info(`📊 Query result: ${result.data ? 'Data received' : 'No data'}`);
        
        return true;
      } catch (strategyError: any) {
        logger.warn(`⚠️ Strategy ${index + 1} exception:`, strategyError.message);
        lastError = strategyError;
        continue; // Try next strategy
      }
    }
    
    // ✅ All strategies failed
    logger.error('❌ All database connection strategies failed');
    if (lastError) {
      logger.error('❌ Last error details:', {
        message: lastError.message,
        code: lastError.code,
        hint: lastError.hint,
        details: lastError.details
      });
      
      // ✅ Provide specific guidance based on error type
      if (lastError.message?.includes('fetch failed')) {
        logger.error('🔒 This appears to be an SSL/TLS or network connectivity issue');
        logger.error('💡 Try the following:');
        logger.error('   1. Check your internet connection');
        logger.error('   2. Verify firewall/proxy settings');
        logger.error('   3. For development, consider using NODE_TLS_REJECT_UNAUTHORIZED=0');
        logger.error('   4. Check if your corporate network blocks HTTPS requests');
      }
    }
    
    return false;
  } catch (error: any) {
    logger.error('❌ Database connection test exception:', {
      message: error.message,
      name: error.name,
      cause: error.cause?.message,
      stack: error.stack?.split('\n')[0] // Only first line of stack
    });
    return false;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

// ✅ ENHANCED: Additional helper functions for debugging
export function getSupabaseConfig(): {
  hasUrl: boolean;
  hasServiceKey: boolean;
  url?: string;
  keyPreview?: string;
  nodeVersion: string;
  platform: string;
} {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : undefined,
    keyPreview: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : undefined,
    nodeVersion: process.version,
    platform: process.platform
  };
}

export async function healthCheckSupabase(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  config: any;
  strategy?: string;
}> {
  const config = getSupabaseConfig();
  
  if (!supabaseClient) {
    return {
      connected: false,
      error: 'Supabase client not initialized',
      config
    };
  }

  try {
    const startTime = Date.now();
    
    // ✅ Use the simplest possible query for health check
    const { error } = await supabaseClient
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    const latency = Date.now() - startTime;

    if (error) {
      return {
        connected: false,
        latency,
        error: error.message,
        config,
        strategy: 'simple-health-check'
      };
    }

    return {
      connected: true,
      latency,
      config,
      strategy: 'simple-health-check'
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
      config,
      strategy: 'simple-health-check'
    };
  }
}

// ✅ NEW: SSL debugging function
export function debugSSLEnvironment(): void {
  logger.info('🔒 SSL/TLS Environment Debug:');
  logger.info(`   NODE_VERSION: ${process.version}`);
  logger.info(`   PLATFORM: ${process.platform}`);
  logger.info(`   ARCH: ${process.arch}`);
  logger.info(`   NODE_ENV: ${process.env.NODE_ENV}`);
  logger.info(`   NODE_TLS_REJECT_UNAUTHORIZED: ${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`);
  logger.info(`   NODE_EXTRA_CA_CERTS: ${process.env.NODE_EXTRA_CA_CERTS || 'not set'}`);
  
  // Check if we're in a corporate environment
  const isLikelyCorporate = !!(
    process.env.HTTP_PROXY || 
    process.env.HTTPS_PROXY || 
    process.env.http_proxy || 
    process.env.https_proxy
  );
  
  if (isLikelyCorporate) {
    logger.warn('🏢 Corporate proxy environment detected');
    logger.info(`   HTTP_PROXY: ${process.env.HTTP_PROXY || 'not set'}`);
    logger.info(`   HTTPS_PROXY: ${process.env.HTTPS_PROXY || 'not set'}`);
  }
}