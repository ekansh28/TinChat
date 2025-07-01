// app/api/test-webhook/route.ts
// 📁 Create this file to test if ANY webhook reaches your server

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('🔥 TEST WEBHOOK RECEIVED!');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    // Log all headers
    const headers = Object.fromEntries(req.headers.entries());
    console.log('📋 Headers:', headers);
    
    // Log body
    const body = await req.text();
    console.log('📄 Body length:', body.length);
    console.log('📄 Body preview:', body.substring(0, 200));
    
    // Try to parse as JSON
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      console.log('📊 Event type:', parsedBody.type);
      console.log('📊 Data ID:', parsedBody.data?.id);
    } catch (e) {
      console.log('📊 Body is not JSON');
    }
    
    console.log('✅ TEST WEBHOOK COMPLETED');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test webhook received',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ TEST WEBHOOK ERROR:', error);
    return NextResponse.json(
      { error: 'Test webhook failed', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Test webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}