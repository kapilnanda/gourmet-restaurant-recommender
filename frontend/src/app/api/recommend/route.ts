import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sample data for demo purposes
    const sampleData = {
      request_id: `sample_${Date.now()}`,
      provider: "sample_data",
      recommendation_response: {
        summary: `Based on your preferences for ${body.cuisines?.join(' and ') || 'various cuisines'} in ${body.location} with a ${body.budget} budget, here are our top recommendations that match your criteria perfectly.`,
        recommendations: [
          {
            rank: 1,
            restaurant_name: "Paradise Restaurant",
            cuisine: body.cuisines?.[0] || "North Indian",
            rating: 4.5,
            cost: body.budget === 'low' ? '₹500 for two' : body.budget === 'medium' ? '₹800 for two' : '₹1500 for two',
            explanation: "Excellent family-friendly restaurant with authentic flavors and great service. Perfect for your preferences."
          },
          {
            rank: 2,
            restaurant_name: "The Garden Cafe",
            cuisine: body.cuisines?.[1] || body.cuisines?.[0] || "Continental",
            rating: 4.3,
            cost: body.budget === 'low' ? '₹400 for two' : body.budget === 'medium' ? '₹700 for two' : '₹1200 for two',
            explanation: "Beautiful ambiance with outdoor seating. Known for consistent quality and attentive staff."
          },
          {
            rank: 3,
            restaurant_name: "Spice Garden",
            cuisine: body.cuisines?.[0] || "Multi-Cuisine",
            rating: 4.2,
            cost: body.budget === 'low' ? '₹600 for two' : body.budget === 'medium' ? '₹900 for two' : '₹1800 for two',
            explanation: "Authentic flavors with modern twist. Great value for money and highly rated by locals."
          }
        ]
      }
    };
    
    return NextResponse.json(sampleData);
    
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
