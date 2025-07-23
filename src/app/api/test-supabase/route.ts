// app/api/test-supabase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Extended Supabase client type with our custom properties
type ExtendedSupabaseClient = SupabaseClient & {
  _lastActivity?: number;
};

// Custom fetch with timeout
const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeout = 5000
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Connection pool manager
const connectionPool = new Map<string, ExtendedSupabaseClient>();

const createSupabaseClient = (url: string, key: string, isServiceRole = false): ExtendedSupabaseClient => {
  const clientKey = `${url}-${isServiceRole ? 'service' : 'anon'}`;
  
  // Reuse existing connection if available
  if (connectionPool.has(clientKey)) {
    return connectionPool.get(clientKey)!;
  }

  const client = createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => 
        fetchWithTimeout(input, init, isServiceRole ? 10000 : 5000),
      headers: {
        'Content-Type': 'application/json',
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }) as ExtendedSupabaseClient;

  // Add our custom tracking property
  client._lastActivity = Date.now();

  connectionPool.set(clientKey, client);
  return client;
};

// Clean up connections periodically
setInterval(() => {
  const now = Date.now();
  connectionPool.forEach((client, key) => {
    // Close clients that haven't been used in last 5 minutes
    if (client._lastActivity && now - client._lastActivity > 300000) {
      client.removeAllChannels();
      connectionPool.delete(key);
    }
  });
}, 60000); // Run every minute

export async function GET(req: NextRequest) {
  try {
    console.log('🧪 Testing Supabase connection...');

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        env: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey,
          hasServiceKey: !!supabaseServiceKey
        }
      }, { status: 500 });
    }

    // Test with anon key
    const anonClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
    anonClient._lastActivity = Date.now();

    try {
      const startTime = Date.now();
      const { data, error } = await anonClient
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      const anonLatency = Date.now() - startTime;

      // Test with service role key if available
      let serviceResult = null;
      if (supabaseServiceKey) {
        const serviceClient = createSupabaseClient(supabaseUrl, supabaseServiceKey, true);
        serviceClient._lastActivity = Date.now();

        try {
          const serviceStartTime = Date.now();
          const { data: serviceData, error: serviceError } = await serviceClient
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .limit(1);
          
          const serviceLatency = Date.now() - serviceStartTime;
          
          if (serviceError) {
            console.error('Service role error details:', {
              code: serviceError.code,
              details: serviceError.details,
              hint: serviceError.hint
            });
            
            serviceResult = {
              success: false,
              error: serviceError.message,
              latency: serviceLatency,
              details: serviceError.details
            };
          } else {
            serviceResult = {
              success: true,
              latency: serviceLatency,
              profileCount: serviceData?.length || 0
            };
          }
        } catch (serviceErr: any) {
          console.error('Service role exception:', serviceErr);
          serviceResult = {
            success: false,
            error: serviceErr.message,
            details: serviceErr.stack
          };
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Supabase connection test completed',
        tests: {
          environmentVariables: 'passed',
          anonConnection: error ? 'failed' : 'passed',
          serviceConnection: serviceResult?.success ? 'passed' : 'failed'
        },
        results: {
          anon: {
            success: !error,
            error: error?.message,
            latency: anonLatency,
            count: data?.length || 0
          },
          service: serviceResult
        },
        env: {
          hasUrl: true,
          hasAnonKey: true,
          hasServiceKey: !!supabaseServiceKey
        },
        dbStats: {
          max_connections: 60,
          active_clients: connectionPool.size
        }
      });

    } catch (anonError: any) {
      return NextResponse.json({
        success: false,
        error: 'Supabase connection failed',
        details: {
          message: anonError.message,
          code: anonError.code,
          name: anonError.name
        },
        tests: {
          environmentVariables: 'passed',
          anonConnection: 'failed',
          serviceConnection: 'not_tested'
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Supabase test failed',
      details: error.message,
      tests: {
        environmentVariables: 'unknown',
        anonConnection: 'failed',
        serviceConnection: 'not_tested'
      }
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for write operations'
      }, { status: 400 });
    }

    const serviceClient = createSupabaseClient(supabaseUrl, supabaseServiceKey, true);
    serviceClient._lastActivity = Date.now();

    // Test creating a dummy profile
    const testClerkId = `test_${Date.now()}`;
    
    const { data, error } = await serviceClient
      .from('user_profiles')
      .insert({
        clerk_id: testClerkId,
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        display_name: 'Test User',
        status: 'offline',
        is_online: false,
        profile_complete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        display_name_color: '#667eea',
        display_name_animation: 'none',
        rainbow_speed: 3,
        badges: [],
        blocked_users: []
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error details:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to insert test profile',
        details: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      }, { status: 500 });
    }

    // Clean up the test profile
    await serviceClient
      .from('user_profiles')
      .delete()
      .eq('clerk_id', testClerkId);

    return NextResponse.json({
      success: true,
      message: 'Supabase write test passed',
      testProfile: {
        id: data.id,
        clerk_id: data.clerk_id,
        username: data.username
      },
      connectionStats: {
        active_clients: connectionPool.size,
        last_activity: serviceClient._lastActivity
      }
    });

  } catch (error: any) {
    console.error('Write test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Write test failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}