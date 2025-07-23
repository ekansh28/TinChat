// Create this file: src/app/api/test/route.ts
// This is a simple test endpoint to verify your API setup

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  console.log('=== TEST ENDPOINT CALLED ===');
  
  try {
    // Test 1: Basic response
    console.log('✓ API route is accessible');

    // Test 2: Environment variables
    const envTest = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasClerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
      nodeEnv: process.env.NODE_ENV
    };
    console.log('Environment variables check:', envTest);

    // Test 3: Clerk authentication
    let authTest: { working: boolean; userId: string | null; error: string | null } = { 
      working: false, 
      userId: null, 
      error: null 
    };
    try {
      const authResult = await auth();
      authTest = {
        working: true,
        userId: authResult.userId,
        error: null
      };
      console.log('✓ Clerk authentication working');
    } catch (authError) {
      authTest.error = authError instanceof Error ? authError.message : 'Unknown auth error';
      console.log('✗ Clerk authentication failed:', authTest.error);
    }

    // Test 4: Supabase connection
    let supabaseTest: { working: boolean; error: string | null } = { 
      working: false, 
      error: null 
    };
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Try a simple query
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1);
      
      if (error) {
        supabaseTest.error = error.message;
        console.log('✗ Supabase connection failed:', error.message);
      } else {
        supabaseTest.working = true;
        console.log('✓ Supabase connection working');
      }
    } catch (supabaseError) {
      supabaseTest.error = supabaseError instanceof Error ? supabaseError.message : 'Unknown Supabase error';
      console.log('✗ Supabase setup failed:', supabaseTest.error);
    }

    const testResults = {
      timestamp: new Date().toISOString(),
      api: { working: true },
      environment: envTest,
      auth: authTest,
      database: supabaseTest,
      request: {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries())
      }
    };

    console.log('=== TEST RESULTS ===', JSON.stringify(testResults, null, 2));

    return NextResponse.json({
      success: true,
      message: 'API test completed',
      results: testResults
    });

  } catch (error) {
    console.error('=== TEST ENDPOINT ERROR ===', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    return NextResponse.json({
      success: true,
      message: 'POST test successful',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}