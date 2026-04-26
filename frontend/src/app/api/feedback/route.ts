import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple feedback response for demo purposes
    console.log('Feedback received:', body);
    
    return NextResponse.json({
      status: "success",
      message: "Feedback recorded successfully"
    });
    
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
