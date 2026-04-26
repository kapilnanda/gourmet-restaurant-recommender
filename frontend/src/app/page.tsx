"use client";

import { useState } from "react";

export default function Home() {
  const [location, setLocation] = useState("Bangalore");
  const [searchQuery, setSearchQuery] = useState("");
  const [budget, setBudget] = useState("medium");
  const [minRating, setMinRating] = useState(4.0);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);

  const [showFilters, setShowFilters] = useState(false);

  const cuisines = [
    "North Indian", "South Indian", "Chinese", "Italian", "Mexican",
    "Thai", "Japanese", "Continental", "Fast Food", "Biryani",
    "Cafe", "Desserts", "Beverages", "Street Food", "Mughlai",
    "Pizza", "Burger", "Healthy Food", "Seafood", "Kebab"
  ];

  const locations = [
    "Bangalore", "Delhi", "Mumbai", "Kolkata", "Chennai",
    "Hyderabad", "Pune", "Jaipur", "Lucknow", "Chandigarh"
  ];

  const toggleCuisine = (c: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const showToast = (msg: string) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setFeedback(null);
    setRequestId(null);

    const payload = {
      location: location,
      budget,
      cuisines: selectedCuisines.length > 0 ? selectedCuisines : ["North Indian"],
      min_rating: minRating,
      party_type: "family",
      additional_preferences: searchQuery.trim()
        ? searchQuery.split(",").map((p) => p.trim()).filter(Boolean)
        : [],
      max_results: 12,
    };

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.detail ? JSON.stringify(errorData.detail) : "Server Error"
        );
      }

      const data = await res.json();
      setResults(data.recommendation_response);
      setRequestId(data.request_id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (type: "up" | "down") => {
    if (!requestId) return;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          feedback_type: type,
        }),
      });

      if (res.ok) {
        setFeedback(type);
        showToast("Thank you for your feedback!");
      }
    } catch (err) {
      console.error("Failed to submit feedback", err);
    }
  };

  const getRestaurantImage = (restaurantName: string, cuisine: string) => {
    const seed = `${restaurantName}-${cuisine}`.replace(/\s+/g, '-').toLowerCase();
    return `https://picsum.photos/seed/${seed}/400/300.jpg`;
  };

  const formatCost = (cost: string) => {
    if (cost.includes('₹')) return cost;
    const costValue = parseInt(cost) || 800;
    return `₹${costValue} for two`;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-red-600">GourmetAI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900">
                <span className="material-symbols-outlined">search</span>
              </button>
              <button className="text-gray-600 hover:text-gray-900">
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Location Selector */}
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <span className="material-symbols-outlined">location_on</span>
                </span>
                <select
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  {locations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <span className="material-symbols-outlined">search</span>
                </span>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Search for restaurants, cuisines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 rounded-full text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">tune</span>
              Filters
              {selectedCuisines.length > 0 && (
                <span className="bg-red-600 text-white rounded-full px-2 py-0.5 text-xs">
                  {selectedCuisines.length}
                </span>
              )}
            </button>
            
            {/* Quick Budget Filters */}
            {["low", "medium", "high"].map(b => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  budget === b 
                    ? "bg-red-600 text-white" 
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </button>
            ))}
            
            {/* Rating Filter */}
            <button
              onClick={() => setMinRating(minRating === 4.0 ? 4.5 : 4.0)}
              className={`px-4 py-2 rounded-full text-sm transition-colors flex items-center gap-1 ${
                minRating === 4.5 
                  ? "bg-red-600 text-white" 
                  : "border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="material-symbols-outlined text-sm">star</span>
              {minRating}+
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h3 className="text-lg font-semibold mb-4">Cuisine Preferences</h3>
            <div className="flex flex-wrap gap-2">
              {cuisines.map(cuisine => (
                <button
                  key={cuisine}
                  onClick={() => toggleCuisine(cuisine)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    selectedCuisines.includes(cuisine)
                      ? "bg-red-600 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {cuisine}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {results && !error && (
          <>
            {/* Results Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {results.recommendations?.length || 0} restaurants found
                </h2>
                <p className="text-gray-600">in {location}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="rating">Rating</option>
                  <option value="cost">Cost</option>
                </select>
              </div>
            </div>

            {/* Restaurant Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.recommendations?.map((item: any, idx: number) => (
                <div key={idx} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Restaurant Image */}
                  <div className="relative h-48">
                    <img
                      src={getRestaurantImage(item.restaurant_name, item.cuisine)}
                      alt={item.restaurant_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-white px-2 py-1 rounded-full text-xs font-semibold">
                      #{item.rank || idx + 1}
                    </div>
                    <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <span className="text-red-600">★</span>
                      {item.rating || 4.5}
                    </div>
                    {item.promoted && (
                      <div className="absolute bottom-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold">
                        Promoted
                      </div>
                    )}
                  </div>

                  {/* Restaurant Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {item.restaurant_name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <span>{item.cuisine || "Multi-Cuisine"}</span>
                      <span>•</span>
                      <span>{formatCost(item.cost || "800")}</span>
                    </div>
                    
                    {/* Additional Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        <span>25-30 min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        <span>{location}</span>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    {item.explanation && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-blue-600 text-sm">lightbulb</span>
                          <span className="text-sm font-semibold text-blue-900">Why you'll like it</span>
                        </div>
                        <p className="text-sm text-blue-800">{item.explanation}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                      <button className="text-red-600 hover:text-red-700 font-medium text-sm">
                        View Menu
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitFeedback("up")}
                          className={`p-2 rounded-full transition-colors ${
                            feedback === "up" 
                              ? "bg-green-100 text-green-600" 
                              : "text-gray-400 hover:text-green-600"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">thumb_up</span>
                        </button>
                        <button
                          onClick={() => submitFeedback("down")}
                          className={`p-2 rounded-full transition-colors ${
                            feedback === "down" 
                              ? "bg-red-100 text-red-600" 
                              : "text-gray-400 hover:text-red-600"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">thumb_down</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!results && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Discover amazing restaurants
            </h3>
            <p className="text-gray-600 mb-6">
              Search for restaurants by location, cuisine, or your preferences
            </p>
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Explore Restaurants
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            <p className="mt-4 text-gray-600">Finding the best restaurants for you...</p>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((msg, i) => (
          <div key={i} className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
