// src/app/api/test-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    console.log('🧪 Test webhook received:', {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: body.substring(0, 200) + (body.length > 200 ? '...' : '')
    });
    
    return NextResponse.json({ 
      message: 'Test webhook received successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test webhook error:', error);
    return NextResponse.json(
      { error: 'Test webhook failed' },
      { status: 500 }
    );
  }
}