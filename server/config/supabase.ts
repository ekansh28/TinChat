// ===== server/config/supabase.ts - COMPLETE FIXED VERSION =====

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';
import https from 'https';
import { URL } from 'url';

interface SupabaseConfig {
  supabaseUrl: string | undefined;
  supabaseServiceKey: string | undefined;
}

interface DatabaseHealth {
  connected: boolean;
  latency: number;
  error?: string;
  connectionAttempts: number;
  method?: string;
}

let globalSupabaseClient: SupabaseClient | null = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

/**
 * ✅ CRITICAL FIX: Initialize Supabase with enhanced networking for Windows
 */
export function initializeSupabase(): SupabaseClient | null {
  try {
    const config = getSupabaseConfig();
    
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      logger.error('❌ Supabase configuration missing - check environment variables');
      logger.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }

    // ✅ CRITICAL FIX: Create enhanced HTTPS agent for Windows compatibility
    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      timeout: 20000,
      maxSockets: 10,
      maxFreeSockets: 5,
      rejectUnauthorized: true,
      // Windows-specific networking fixes
      servername: new URL(config.supabaseUrl).hostname,
      secureProtocol: 'TLSv1_2_method',
      // Additional Windows fixes
      family: 4, // Force IPv4
      lookup: undefined, // Use default DNS
    });

    // ✅ CRITICAL FIX: Custom fetch with comprehensive error handling
    const customFetch = async (url: string, options: any = {}) => {
      const startTime = Date.now();
      logger.debug(`🌐 Supabase fetch: ${url.substring(0, 100)}...`);
      
      try {
        const response = await fetch(url, {
          ...options,
          agent: url.startsWith('https:') ? httpsAgent : undefined,
          timeout: 20000,
          compress: true,
          follow: 3,
          headers: {
            'User-Agent': 'TinChat-Server/1.0 (Node.js)',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            ...options.headers,
          },
        });

        const duration = Date.now() - startTime;
        logger.debug(`✅ Fetch success: ${response.status} (${duration}ms)`);
        return response;
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Fetch failed for ${url} (${duration}ms):`, {
          message: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          hostname: error.hostname,
          type: error.type,
        });

        // Enhanced error handling for specific Windows issues
        if (error.code === 'ENOTFOUND') {
          throw new Error(`DNS resolution failed for ${new URL(url).hostname}. Check your internet connection.`);
        } else if (error.code === 'ECONNRESET') {
          throw new Error(`Connection reset by server. This might be a firewall or proxy issue.`);
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error(`Request timeout. The server took too long to respond.`);
        } else if (error.code === 'CERT_AUTHORITY_INVALID') {
          throw new Error(`SSL certificate validation failed. Check system time and certificates.`);
        }
        
        throw error;
      }
    };

    // ✅ ENHANCED: Supabase client with comprehensive configuration
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        flowType: 'pkce'
      },
      db: {
        schema: 'public',
      },
      global: {
     
        headers: {
          'User-Agent': 'TinChat-Server/1.0 (Node.js)',
          'X-Client-Info': 'tinchat-server',
        },
      },
      realtime: {
        params: {
          eventsPerSecond: 2,
        },
      },
    });

    globalSupabaseClient = supabase;
    logger.info('✅ Supabase client initialized with enhanced Windows networking');
    
    return supabase;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * ✅ ENHANCED: Multi-method database connection testing
 */
export async function testDatabaseConnection(supabase: SupabaseClient): Promise<boolean> {
  if (!supabase) {
    logger.error('❌ No Supabase client provided for connection test');
    return false;
  }

  // Method 1: Try Supabase client
  try {
    logger.info('🔍 Testing database with Supabase client...');
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (error) {
      logger.warn('⚠️ Supabase client test failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // Try direct HTTP method as fallback
      logger.info('🔄 Trying direct HTTP connection...');
      return await testDatabaseConnectionDirect();
    }

    logger.info(`✅ Supabase client test passed - found ${data?.length || 0} records`);
    return true;

  } catch (error: any) {
    logger.warn('⚠️ Supabase client test exception:', {
      message: error.message,
      code: error.code,
      name: error.name,
    });
    
    // Try direct HTTP method as fallback
    logger.info('🔄 Trying direct HTTP connection...');
    return await testDatabaseConnectionDirect();
  }
}

/**
 * ✅ NEW: Direct HTTP database connection test
 */
async function testDatabaseConnectionDirect(): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    logger.error('❌ Missing Supabase configuration for direct test');
    return false;
  }

  try {
    logger.info('🔍 Testing database with direct HTTP...');
    
    const httpsAgent = new https.Agent({
      keepAlive: true,
      timeout: 15000,
      rejectUnauthorized: true,
      servername: new URL(config.supabaseUrl).hostname,
      secureProtocol: 'TLSv1_2_method',
      family: 4,
    });

    const url = `${config.supabaseUrl}/rest/v1/user_profiles?select=id&limit=1`;
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'GET',
      agent: httpsAgent,
      headers: {
        'apikey': config.supabaseServiceKey,
        'Authorization': `Bearer ${config.supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TinChat-Server/1.0 (Direct)',
        'Accept': 'application/json',
      },
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      logger.error(`❌ Direct HTTP test failed: ${response.status} ${response.statusText} (${latency}ms)`);
      const errorText = await response.text();
      logger.error(`Response body: ${errorText.substring(0, 200)}`);
      return false;
    }

    const data = await response.json();
    const recordCount = Array.isArray(data) ? data.length : 0;
    
    logger.info(`✅ Direct HTTP test passed - found ${recordCount} records (${latency}ms)`);
    return true;

  } catch (error: any) {
    logger.error('❌ Direct HTTP test failed:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname,
    });
    return false;
  }
}

/**
 * ✅ ENHANCED: Database health check with retry logic
 */
export async function getDatabaseHealth(supabase: SupabaseClient): Promise<DatabaseHealth> {
  const startTime = Date.now();
  let health: DatabaseHealth = {
    connected: false,
    latency: 0,
    connectionAttempts: 0,
  };

  const maxRetries = 3;
  const retryDelays = [1000, 2000, 3000]; // Progressive delays

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    health.connectionAttempts = attempt;
    const attemptStart = Date.now();
    
    try {
      logger.debug(`🔍 Health check attempt ${attempt}/${maxRetries}`);
      
      // Try Supabase client first
      try {
        const { count, error } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true });

        health.latency = Date.now() - attemptStart;

        if (error) {
          throw new Error(`Supabase error: ${error.code} - ${error.message}`);
        }

        health.connected = true;
        health.method = 'supabase-client';
        logger.info(`✅ Health check passed via Supabase client (attempt ${attempt}, ${health.latency}ms)`);
        return health;

      } catch (clientError: any) {
        logger.debug(`⚠️ Supabase client failed on attempt ${attempt}: ${clientError.message}`);
        
        // Try direct HTTP as fallback
        const directResult = await testDatabaseConnectionDirect();
        if (directResult) {
          health.connected = true;
          health.method = 'direct-http';
          health.latency = Date.now() - attemptStart;
          logger.info(`✅ Health check passed via direct HTTP (attempt ${attempt}, ${health.latency}ms)`);
          return health;
        }
        
        throw clientError;
      }

    } catch (error: any) {
      health.latency = Date.now() - attemptStart;
      health.error = error.message || 'Unknown error';
      
      logger.warn(`⚠️ Health check attempt ${attempt} failed: ${health.error} (${health.latency}ms)`);
      
      if (attempt < maxRetries) {
        const delay = retryDelays[attempt - 1];
        logger.debug(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  logger.error(`❌ All ${maxRetries} health check attempts failed`);
  return health;
}

/**
 * ✅ NEW: Comprehensive network diagnostics
 */
export async function runNetworkDiagnostics(): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.supabaseUrl) {
    logger.error('❌ No Supabase URL for diagnostics');
    return;
  }

  logger.info('🔍 Running comprehensive network diagnostics...');
  
  const url = new URL(config.supabaseUrl);
  
  // Test 1: DNS Resolution
  try {
    const dns = require('dns').promises;
    const addresses = await dns.lookup(url.hostname);
    logger.info(`✅ DNS Resolution: ${url.hostname} -> ${addresses.address} (family: IPv${addresses.family})`);
  } catch (error: any) {
    logger.error(`❌ DNS Resolution failed: ${error.message}`);
  }

  // Test 2: TCP Connection
  try {
    const net = require('net');
    const socket = new net.Socket();
    
    await new Promise((resolve, reject) => {
      socket.setTimeout(5000);
      socket.connect(443, url.hostname, () => {
        logger.info(`✅ TCP Connection: ${url.hostname}:443 reachable`);
        resolve(undefined);
      });
      socket.on('error', reject);
      socket.on('timeout', () => reject(new Error('Connection timeout')));
    });
    
    socket.destroy();
  } catch (error: any) {
    logger.error(`❌ TCP Connection failed: ${error.message}`);
  }

  // Test 3: Basic HTTPS Request
  try {
    const response = await fetch(config.supabaseUrl, {
      method: 'HEAD',
      agent: new https.Agent({
        keepAlive: true,
        timeout: 5000,
        rejectUnauthorized: true,
        servername: url.hostname,
        secureProtocol: 'TLSv1_2_method',
      }),
      headers: {
        'User-Agent': 'TinChat-Diagnostics/1.0'
      }
    });
    logger.info(`✅ HTTPS Request: ${response.status} ${response.statusText}`);
  } catch (error: any) {
    logger.error(`❌ HTTPS Request failed: ${error.message}`);
  }

  // Test 4: Environment Information
  logger.info('📊 Environment Information:');
  logger.info(`  Node.js: ${process.version}`);
  logger.info(`  Platform: ${process.platform} ${process.arch}`);
  logger.info(`  OpenSSL: ${process.versions.openssl}`);
  logger.info(`  UV: ${process.versions.uv}`);
  logger.info(`  V8: ${process.versions.v8}`);
  
  // Test 5: Network Configuration
  logger.info('🌐 Network Configuration:');
  logger.info(`  SUPABASE_URL: ${config.supabaseUrl ? 'Set (' + url.hostname + ')' : 'Missing'}`);
  logger.info(`  SUPABASE_SERVICE_ROLE_KEY: ${config.supabaseServiceKey ? 'Set (length: ' + config.supabaseServiceKey.length + ')' : 'Missing'}`);
  logger.info(`  NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  logger.info(`  HTTP_PROXY: ${process.env.HTTP_PROXY || 'none'}`);
  logger.info(`  HTTPS_PROXY: ${process.env.HTTPS_PROXY || 'none'}`);
  logger.info(`  NO_PROXY: ${process.env.NO_PROXY || 'none'}`);

  // Test 6: System Information
  const os = require('os');
  logger.info('💻 System Information:');
  logger.info(`  OS: ${os.type()} ${os.release()}`);
  logger.info(`  Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)}MB`);
  logger.info(`  Free Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB`);
  logger.info(`  CPU Count: ${os.cpus().length}`);
  logger.info(`  Network Interfaces: ${Object.keys(os.networkInterfaces()).join(', ')}`);
}

/**
 * ✅ NEW: Check required tables with enhanced error handling
 */
export async function checkRequiredTables(supabase: SupabaseClient): Promise<{
  allTablesExist: boolean;
  missingTables: string[];
  errors: string[];
  accessibleTables: string[];
}> {
  const requiredTables = ['user_profiles', 'friendships', 'friend_requests', 'blocked_users'];
  const missingTables: string[] = [];
  const errors: string[] = [];
  const accessibleTables: string[] = [];

  for (const table of requiredTables) {
    try {
      logger.debug(`🔍 Checking table: ${table}`);
      
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          missingTables.push(table);
          logger.warn(`❌ Table missing: ${table}`);
        } else {
          errors.push(`${table}: ${error.message}`);
          logger.error(`❌ Table error ${table}: ${error.message}`);
        }
      } else {
        accessibleTables.push(table);
        logger.info(`✅ Table accessible: ${table} (${count || 0} records)`);
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        missingTables.push(table);
        logger.warn(`❌ Table missing: ${table}`);
      } else {
        errors.push(`${table}: ${error.message}`);
        logger.error(`❌ Table exception ${table}: ${error.message}`);
      }
    }
  }

  const result = {
    allTablesExist: missingTables.length === 0 && errors.length === 0,
    missingTables,
    errors,
    accessibleTables,
  };

  logger.info(`📊 Table check results: ${accessibleTables.length}/${requiredTables.length} accessible`);
  return result;
}

// ===== Helper Functions =====

function getSupabaseConfig(): SupabaseConfig {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };

  // Validate URL format
  if (config.supabaseUrl && !config.supabaseUrl.startsWith('https://')) {
    logger.error('❌ Supabase URL must start with https://');
    config.supabaseUrl = undefined;
  }

  // Validate URL is a Supabase URL
  if (config.supabaseUrl && !config.supabaseUrl.includes('.supabase.co')) {
    logger.warn('⚠️ URL does not appear to be a Supabase URL');
  }

  return config;
}

export function getSupabaseClient(): SupabaseClient | null {
  return globalSupabaseClient;
}

/**
 * ✅ ENHANCED: Reinitialize with diagnostics
 */
export async function reinitializeSupabase(): Promise<SupabaseClient | null> {
  logger.info('🔄 Reinitializing Supabase with diagnostics...');
  
  // Clear existing client
  globalSupabaseClient = null;
  connectionAttempts = 0;
  
  // Run network diagnostics
  await runNetworkDiagnostics();
  
  // Initialize new client
  const supabase = initializeSupabase();
  
  if (supabase) {
    // Test the connection
    const isHealthy = await testDatabaseConnection(supabase);
    if (isHealthy) {
      // Check tables
      const tableCheck = await checkRequiredTables(supabase);
      logger.info('✅ Supabase reinitialization successful');
      logger.info(`📊 Tables: ${tableCheck.accessibleTables.length}/${tableCheck.accessibleTables.length + tableCheck.missingTables.length} accessible`);
      return supabase;
    } else {
      logger.error('❌ Supabase reinitialization failed - connection test failed');
      return null;
    }
  }
  
  logger.error('❌ Supabase reinitialization failed - client creation failed');
  return null;
}

/**
 * ✅ NEW: Connection reporter with enhanced metrics
 */
export function createConnectionReporter() {
  return {
    getConnectionAttempts: () => connectionAttempts,
    getGlobalClient: () => globalSupabaseClient,
    
    async runDiagnostics(supabase: SupabaseClient) {
      logger.info('🔍 Running comprehensive Supabase diagnostics...');
      
      const startTime = Date.now();
      
      // Run all tests
      const [health, tableCheck] = await Promise.allSettled([
        getDatabaseHealth(supabase),
        checkRequiredTables(supabase)
      ]);
      
      const totalTime = Date.now() - startTime;
      
      const report = {
        timestamp: new Date().toISOString(),
        totalDiagnosticTime: totalTime,
        health: health.status === 'fulfilled' ? health.value : { 
          connected: false, 
          error: 'Health check failed',
          connectionAttempts: 0,
          latency: 0
        },
        tables: tableCheck.status === 'fulfilled' ? tableCheck.value : {
          allTablesExist: false,
          missingTables: [],
          errors: ['Table check failed'],
          accessibleTables: []
        },
        connectionAttempts,
        recommendations: [] as string[]
      };
      
      // Generate recommendations
      if (!report.health.connected) {
        report.recommendations.push('Check internet connection and firewall settings');
        report.recommendations.push('Verify Supabase service status');
        report.recommendations.push('Run network diagnostics: npm run diagnose');
      }
      
      if (report.tables.missingTables.length > 0) {
        report.recommendations.push(`Create missing tables: ${report.tables.missingTables.join(', ')}`);
      }
      
      if (report.tables.errors.length > 0) {
        report.recommendations.push('Check database permissions and schema');
      }
      
      if (report.health.latency > 1000) {
        report.recommendations.push('High latency detected - check network connection');
      }
      
      logger.info('📋 Comprehensive diagnostics complete:', {
        connected: report.health.connected,
        latency: report.health.latency,
        tables: `${report.tables.accessibleTables.length}/${report.tables.accessibleTables.length + report.tables.missingTables.length}`,
        totalTime: totalTime,
        recommendations: report.recommendations.length
      });
      
      return report;
    }
  };
}