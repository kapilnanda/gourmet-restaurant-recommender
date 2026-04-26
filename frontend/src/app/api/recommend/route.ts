import { NextRequest, NextResponse } from 'next/server';

const sampleRestaurants = [
  {
    name: "Paradise Biryani",
    cuisines: ["North Indian", "Biryani", "Mughlai"],
    rating: 4.6,
    costLow: 600,
    costMedium: 900,
    costHigh: 1500,
    explanation: "Legendary biryani destination known for authentic Hyderabadi flavors and generous portions. A must-visit for biryani lovers.",
    promoted: true
  },
  {
    name: "The Garden Cafe",
    cuisines: ["Continental", "Italian", "Cafe"],
    rating: 4.4,
    costLow: 400,
    costMedium: 700,
    costHigh: 1200,
    explanation: "Charming cafe with beautiful garden seating. Perfect for romantic dinners and relaxed brunches with fresh ingredients.",
    promoted: false
  },
  {
    name: "Spice Route",
    cuisines: ["Chinese", "Thai", "Pan-Asian"],
    rating: 4.5,
    costLow: 500,
    costMedium: 800,
    costHigh: 1400,
    explanation: "Authentic Asian flavors with modern presentation. Excellent sushi and dim sum with attentive service.",
    promoted: false
  },
  {
    name: "BBQ Nation",
    cuisines: ["North Indian", "BBQ", "Grill"],
    rating: 4.3,
    costLow: 700,
    costMedium: 1000,
    costHigh: 1600,
    explanation: "Live grill experience with unlimited starters. Great for groups and special occasions with lively atmosphere.",
    promoted: true
  },
  {
    name: "Saravana Bhavan",
    cuisines: ["South Indian", "Vegetarian"],
    rating: 4.2,
    costLow: 300,
    costMedium: 500,
    costHigh: 800,
    explanation: "Authentic South Indian vegetarian cuisine. Famous for dosas and filter coffee in a clean, traditional setting.",
    promoted: false
  },
  {
    name: "Mainland China",
    cuisines: ["Chinese", "Continental"],
    rating: 4.4,
    costLow: 800,
    costMedium: 1200,
    costHigh: 1800,
    explanation: "Upscale Chinese dining with elegant ambiance. Known for Peking duck and extensive wine selection.",
    promoted: false
  },
  {
    name: "Toit",
    cuisines: ["Brewery", "Continental", "Fast Food"],
    rating: 4.5,
    costLow: 600,
    costMedium: 900,
    costHigh: 1500,
    explanation: "Craft brewery with innovative food pairings. Great for casual evenings with friends and live music on weekends.",
    promoted: true
  },
  {
    name: "Truffles",
    cuisines: ["Italian", "Continental", "Pizza"],
    rating: 4.3,
    costLow: 500,
    costMedium: 800,
    costHigh: 1300,
    explanation: "Cozy Italian restaurant with wood-fired pizzas. Perfect for family dinners with warm, rustic ambiance.",
    promoted: false
  },
  {
    name: "Meghana Foods",
    cuisines: ["North Indian", "Biryani"],
    rating: 4.1,
    costLow: 400,
    costMedium: 600,
    costHigh: 1000,
    explanation: "Budget-friendly option for delicious biryani and North Indian curries. Quick service and consistent quality.",
    promoted: false
  },
  {
    name: "Olive Beach",
    cuisines: ["Continental", "Mediterranean", "Italian"],
    rating: 4.6,
    costLow: 1000,
    costMedium: 1500,
    costHigh: 2500,
    explanation: "Upscale beach-themed restaurant with Mediterranean cuisine. Perfect for special occasions and romantic dinners.",
    promoted: true
  },
  {
    name: "Chili's",
    cuisines: ["Mexican", "American", "Fast Food"],
    rating: 4.2,
    costLow: 700,
    costMedium: 1000,
    costHigh: 1600,
    explanation: "Vibrant Mexican-American chain with generous portions. Famous for fajitas and margaritas in a lively setting.",
    promoted: false
  },
  {
    name: "Punjabi Rasoi",
    cuisines: ["North Indian", "Punjabi"],
    rating: 4.0,
    costLow: 350,
    costMedium: 550,
    costHigh: 900,
    explanation: "Authentic Punjabi home-style cooking. Rich, flavorful curries and tandoori dishes at affordable prices.",
    promoted: false
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Filter restaurants based on user preferences
    let filteredRestaurants = sampleRestaurants.filter(restaurant => {
      // Filter by cuisine
      if (body.cuisines && body.cuisines.length > 0) {
        const hasMatchingCuisine = restaurant.cuisines.some((cuisine: string) => 
          body.cuisines.some((pref: string) => cuisine.toLowerCase().includes(pref.toLowerCase()))
        );
        if (!hasMatchingCuisine) return false;
      }
      
      // Filter by rating
      if (body.min_rating && restaurant.rating < body.min_rating) {
        return false;
      }
      
      return true;
    });
    
    // Sort by rating (highest first) and limit results
    filteredRestaurants = filteredRestaurants
      .sort((a, b) => b.rating - a.rating)
      .slice(0, body.max_results || 12);
    
    // Format the response
    const recommendations = filteredRestaurants.map((restaurant, index) => ({
      rank: index + 1,
      restaurant_name: restaurant.name,
      cuisine: restaurant.cuisines.join(", "),
      rating: restaurant.rating,
      cost: body.budget === 'low' ? `₹${restaurant.costLow} for two` : 
            body.budget === 'medium' ? `₹${restaurant.costMedium} for two` : 
            `₹${restaurant.costHigh} for two`,
      explanation: restaurant.explanation,
      promoted: restaurant.promoted
    }));
    
    const sampleData = {
      request_id: `sample_${Date.now()}`,
      provider: "ai_recommender",
      recommendation_response: {
        summary: `Found ${recommendations.length} amazing restaurants in ${body.location} matching your preferences for ${body.cuisines?.join(' and ') || 'various cuisines'} with ${body.budget} budget options.`,
        recommendations: recommendations
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
