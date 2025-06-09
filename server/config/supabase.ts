// server/config/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export function initializeSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.warn('⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY - profile features will be disabled');
    logger.warn(`URL exists: ${!!supabaseUrl}, Service key exists: ${!!supabaseServiceKey}`);
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      // Optimize for server-side usage
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-client-info': 'tinchat-server/1.0.0'
        }
      }
    });

    logger.info('✅ Supabase client initialized successfully');
    return supabase;
  } catch (error) {
    logger.error('❌ Failed to initialize Supabase client:', error);
    return null;
  }
}

// Database utility functions
export async function testDatabaseConnection(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
    
    logger.info('✅ Database connection test passed');
    return true;
  } catch (error) {
    logger.error('Database connection test exception:', error);
    return false;
  }
}