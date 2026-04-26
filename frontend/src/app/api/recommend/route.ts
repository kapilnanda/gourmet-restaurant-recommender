import { NextRequest, NextResponse } from 'next/server';

const restaurantDatabase = {
  "Bangalore": [
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
    }
  ],
  "Delhi": [
    {
      name: "Karim's",
      cuisines: ["North Indian", "Mughlai", "Kebab"],
      rating: 4.7,
      costLow: 500,
      costMedium: 800,
      costHigh: 1400,
      explanation: "Iconic Mughlai restaurant serving authentic Delhi cuisine for over 100 years. Famous for kebabs and nihari.",
      promoted: true
    },
    {
      name: "Indian Accent",
      cuisines: ["Continental", "Indian", "Fine Dining"],
      rating: 4.8,
      costLow: 1200,
      costMedium: 2000,
      costHigh: 3500,
      explanation: "Award-winning fine dining restaurant with innovative Indian cuisine. Perfect for special occasions and business dinners.",
      promoted: true
    },
    {
      name: "Moti Mahal Delux",
      cuisines: ["North Indian", "Mughlai"],
      rating: 4.4,
      costLow: 600,
      costMedium: 1000,
      costHigh: 1800,
      explanation: "Traditional Mughlai restaurant with royal ambiance. Known for butter chicken and dal makhani.",
      promoted: false
    },
    {
      name: "Bukhara",
      cuisines: ["North Indian", "Mughlai", "Fine Dining"],
      rating: 4.6,
      costLow: 1500,
      costMedium: 2500,
      costHigh: 4000,
      explanation: "Premium dining experience with authentic Northwest Frontier cuisine. Excellent service and elegant ambiance.",
      promoted: true
    }
  ],
  "Mumbai": [
    {
      name: "Leopold Cafe & Bar",
      cuisines: ["Continental", "Cafe", "Bar"],
      rating: 4.5,
      costLow: 800,
      costMedium: 1200,
      costHigh: 2000,
      explanation: "Trendy cafe with colonial charm. Great for brunches, cocktails, and people-watching.",
      promoted: true
    },
    {
      name: "Mahesh Lunch Home",
      cuisines: ["South Indian", "Vegetarian"],
      rating: 4.2,
      costLow: 200,
      costMedium: 350,
      costHigh: 600,
      explanation: "Legendary Mumbai eatery serving authentic South Indian thalis. Quick service and incredible value for money.",
      promoted: false
    },
    {
      name: "Britannia & Co.",
      cuisines: ["Continental", "Bakery", "Cafe"],
      rating: 4.6,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "Iconic Irani cafe since 1923. Famous for berry pulao, brun maska, and old-world charm.",
      promoted: true
    },
    {
      name: "Gajalee",
      cuisines: ["Seafood", "Konkan", "Maharashtrian"],
      rating: 4.3,
      costLow: 600,
      costMedium: 1000,
      costHigh: 1800,
      explanation: "Authentic Konkan seafood with traditional Maharashtrian flavors. Fresh catch and coastal specialties.",
      promoted: false
    }
  ],
  "Pune": [
    {
      name: "Chaitanya Parathas",
      cuisines: ["North Indian", "Maharashtrian", "Breakfast"],
      rating: 4.3,
      costLow: 150,
      costMedium: 250,
      costHigh: 400,
      explanation: "Famous for authentic Maharashtrian parathas. Hearty breakfast and snacks at pocket-friendly prices.",
      promoted: false
    },
    {
      name: "Durvankur",
      cuisines: ["North Indian", "Mughlai", "Kebab"],
      rating: 4.4,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "Legendary kebab house serving authentic Mughlai cuisine. Known for seekh kebabs and biryani.",
      promoted: true
    },
    {
      name: "Kayani Bakery",
      cuisines: ["Bakery", "Mithai", "Snacks"],
      rating: 4.1,
      costLow: 100,
      costMedium: 200,
      costHigh: 350,
      explanation: "Historic bakery famous for traditional mithai and baked goods. Perfect for sweets and snacks.",
      promoted: false
    },
    {
      name: "The Place - Toast & Tacos",
      cuisines: ["Mexican", "Continental", "Fast Food"],
      rating: 4.2,
      costLow: 500,
      costMedium: 800,
      costHigh: 1400,
      explanation: "Trendy restaurant with innovative tacos and toast combinations. Great for casual dining and drinks.",
      promoted: false
    }
  ],
  "Jaipur": [
    {
      name: "Laxmi Mishthan Bhandar",
      cuisines: ["North Indian", "Rajasthani", "Vegetarian"],
      rating: 4.5,
      costLow: 200,
      costMedium: 350,
      costHigh: 600,
      explanation: "Iconic Jaipur restaurant serving authentic Rajasthani thali. Famous for dal baati churma and gatte ki sabzi.",
      promoted: true
    },
    {
      name: "Chokhi Dhani",
      cuisines: ["North Indian", "Rajasthani", "Fine Dining"],
      rating: 4.6,
      costLow: 800,
      costMedium: 1400,
      costHigh: 2200,
      explanation: "Traditional Rajasthani village theme restaurant. Folk music, puppet shows, and authentic regional cuisine.",
      promoted: true
    },
    {
      name: "Panna Lal",
      cuisines: ["North Indian", "Street Food"],
      rating: 4.2,
      costLow: 100,
      costMedium: 200,
      costHigh: 350,
      explanation: "Famous street food vendor known for kachoris and samosas. Quick service and authentic flavors.",
      promoted: false
    },
    {
      name: "Handi Restaurant",
      cuisines: ["North Indian", "Rajasthani"],
      rating: 4.3,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "Rajasthani cuisine served in traditional handi pots. Rich flavors and royal recipes.",
      promoted: false
    }
  ],
  "Kolkata": [
    {
      name: "Peter Cat",
      cuisines: ["Continental", "Chinese", "Fast Food"],
      rating: 4.1,
      costLow: 300,
      costMedium: 500,
      costHigh: 800,
      explanation: "Iconic Kolkata institution serving Chinese and Continental cuisine. Famous for chow mein and hot and sour soup.",
      promoted: false
    },
    {
      name: "Mocambo",
      cuisines: ["Continental", "Fine Dining"],
      rating: 4.7,
      costLow: 1000,
      costMedium: 1800,
      costHigh: 3000,
      explanation: "Elegant fine dining restaurant with European cuisine. Perfect for romantic dinners and special occasions.",
      promoted: true
    },
    {
      name: "6 Ballygunge Place",
      cuisines: ["North Indian", "Continental", "Cafe"],
      rating: 4.4,
      costLow: 600,
      costMedium: 1000,
      costHigh: 1800,
      explanation: "Historic restaurant serving Indian and Continental cuisine. Beautiful colonial ambiance and live jazz.",
      promoted: true
    },
    {
      name: "Aminia",
      cuisines: ["North Indian", "Mughlai", "Biryani"],
      rating: 4.3,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "Legendary biryani destination. Authentic Awadhi cuisine and aromatic biryanis.",
      promoted: false
    }
  ],
  "Chennai": [
    {
      name: "Murugan Idli Shop",
      cuisines: ["South Indian", "Breakfast", "Vegetarian"],
      rating: 4.2,
      costLow: 100,
      costMedium: 200,
      costHigh: 350,
      explanation: "Iconic Chennai institution serving authentic idlis and dosas. Famous for chutney varieties and filter coffee.",
      promoted: true
    },
    {
      name: "Sangeetha Veg Restaurant",
      cuisines: ["South Indian", "Vegetarian"],
      rating: 4.1,
      costLow: 200,
      costMedium: 350,
      costHigh: 600,
      explanation: "Popular vegetarian restaurant serving traditional South Indian meals. Great thali options and authentic flavors.",
      promoted: false
    },
    {
      name: "The Crown",
      cuisines: ["Continental", "Chinese", "Fine Dining"],
      rating: 4.5,
      costLow: 800,
      costMedium: 1400,
      costHigh: 2200,
      explanation: "Upscale restaurant with panoramic city views. Excellent service and diverse menu options.",
      promoted: true
    },
    {
      name: "Anjappar",
      cuisines: ["South Indian", "Chettinad"],
      rating: 4.3,
      costLow: 300,
      costMedium: 500,
      costHigh: 900,
      explanation: "Authentic Chettinad cuisine restaurant. Known for spicy flavors and traditional recipes.",
      promoted: false
    }
  ],
  "Hyderabad": [
    {
      name: "Paradise",
      cuisines: ["North Indian", "Biryani", "Mughlai"],
      rating: 4.6,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "World-famous biryani destination. Authentic Hyderabadi biryanis and haleem during Ramadan.",
      promoted: true
    },
    {
      name: "Bawarchi",
      cuisines: ["North Indian", "Hyderabadi"],
      rating: 4.4,
      costLow: 300,
      costMedium: 500,
      costHigh: 800,
      explanation: "Traditional Hyderabadi cuisine restaurant. Famous for haleem, nahari, and authentic regional dishes.",
      promoted: false
    },
    {
      name: "Shah Ghouse",
      cuisines: ["North Indian", "Biryani"],
      rating: 4.2,
      costLow: 350,
      costMedium: 600,
      costHigh: 1000,
      explanation: "Popular biryani spot with consistent quality. Good portions and reasonable prices.",
      promoted: false
    },
    {
      name: "Ohri's",
      cuisines: ["North Indian", "Continental", "Fine Dining"],
      rating: 4.5,
      costLow: 800,
      costMedium: 1400,
      costHigh: 2200,
      explanation: "Upscale dining with Indian and Continental fusion. Excellent ambiance and service.",
      promoted: true
    }
  ],
  "Lucknow": [
    {
      name: "Tunday Kababi",
      cuisines: ["North Indian", "Kebab", "Mughlai"],
      rating: 4.7,
      costLow: 300,
      costMedium: 500,
      costHigh: 900,
      explanation: "Legendary kebab house serving melt-in-mouth galouti kebabs. Over 100 years of culinary excellence.",
      promoted: true
    },
    {
      name: "Idris Biryani",
      cuisines: ["North Indian", "Biryani", "Awadhi"],
      rating: 4.5,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "Famous for Lucknowi biryani and Awadhi cuisine. Authentic flavors and aromatic rice.",
      promoted: false
    },
    {
      name: "Royal Cafe",
      cuisines: ["Continental", "North Indian", "Cafe"],
      rating: 4.3,
      costLow: 500,
      costMedium: 800,
      costHigh: 1400,
      explanation: "Elegant cafe with colonial charm. Great for meetings, snacks, and light meals.",
      promoted: false
    }
  ],
  "Chandigarh": [
    {
      name: "Pal Dhaba",
      cuisines: ["North Indian", "Punjabi", "Dhaba"],
      rating: 4.4,
      costLow: 200,
      costMedium: 350,
      costHigh: 600,
      explanation: "Authentic Punjabi dhaba experience. Rich, flavorful curries and tandoori dishes at great prices.",
      promoted: false
    },
    {
      name: "Gopal Ji",
      cuisines: ["North Indian", "Vegetarian", "Sweets"],
      rating: 4.2,
      costLow: 150,
      costMedium: 300,
      costHigh: 500,
      explanation: "Famous for traditional Punjabi sweets and vegetarian meals. Known for paneer dishes and fresh sweets.",
      promoted: false
    },
    {
      name: "Sector 17",
      cuisines: ["Continental", "Chinese", "Fast Food"],
      rating: 4.1,
      costLow: 400,
      costMedium: 700,
      costHigh: 1200,
      explanation: "Popular multi-cuisine restaurant in Sector 17. Good variety and reasonable prices.",
      promoted: false
    }
  ]
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Debug logging
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // Get restaurants for the selected location
    const locationRestaurants = restaurantDatabase[body.location] || restaurantDatabase["Bangalore"];
    console.log('Location restaurants count:', locationRestaurants.length);
    
    // Filter restaurants based on user preferences
    let filteredRestaurants = locationRestaurants.filter((restaurant: any) => {
      // Filter by cuisine
      if (body.cuisines && body.cuisines.length > 0) {
        const hasMatchingCuisine = restaurant.cuisines.some((cuisine: string) => 
          body.cuisines.some((pref: string) => cuisine.toLowerCase().includes(pref.toLowerCase()))
        );
        if (!hasMatchingCuisine) {
          console.log(`Filtered out ${restaurant.name} - no matching cuisine`);
          return false;
        }
      }
      
      // Filter by rating
      if (body.min_rating && restaurant.rating < body.min_rating) {
        console.log(`Filtered out ${restaurant.name} - rating too low: ${restaurant.rating} < ${body.min_rating}`);
        return false;
      }
      
      return true;
    });
    
    console.log('Filtered restaurants count:', filteredRestaurants.length);
    
    // Sort by rating (highest first) and limit results
    filteredRestaurants = filteredRestaurants
      .sort((a: any, b: any) => b.rating - a.rating)
      .slice(0, body.max_results || 12);
    
    // Format the response
    const recommendations = filteredRestaurants.map((restaurant: any, index: number) => ({
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
