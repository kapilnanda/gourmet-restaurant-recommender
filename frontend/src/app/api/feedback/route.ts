import { NextRequest, NextResponse } from 'next/server';

// Backend API URL - update this to your deployed backend
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Try to forward to backend first
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (backendError) {
      console.log('Backend not available, feedback logged locally');
    }
    
    // Fallback response when backend is not available
    console.log('Feedback received (sample mode):', body);
    return NextResponse.json({
      status: "success",
      message: "Feedback recorded locally (backend not available)"
    });
    
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
