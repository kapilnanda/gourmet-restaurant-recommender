"use client";

import { useState } from "react";

export default function Home() {
  const [location, setLocation] = useState("Bangalore");
  const [budget, setBudget] = useState("medium");
  const [minRating, setMinRating] = useState(4.2);
  const [additionalPrefs, setAdditionalPrefs] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);

  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
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
      additional_preferences: additionalPrefs.trim()
        ? additionalPrefs.split(",").map((p) => p.trim()).filter(Boolean)
        : [],
      max_results: 3,
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

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen pb-32">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/20 bg-white/70 backdrop-blur-[30px] shadow-[0_10px_30px_rgba(74,74,74,0.05)]">
        <div className="flex justify-between items-center h-16 px-5 w-full">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">person</span>
            </div>
            <h1 className="font-['Space_Grotesk'] font-bold tracking-tight text-xl text-[#D4AF37] uppercase tracking-widest">
              Gourmet AI
            </h1>
          </div>
          <button className="hover:opacity-80 transition-opacity active:scale-95 duration-200">
            <span className="material-symbols-outlined text-slate-400">tune</span>
          </button>
        </div>
      </header>

      <main className="pt-24 px-container-margin space-y-xl max-w-2xl mx-auto">
        {/* Hero & Preference Form */}
        <section className="space-y-lg">
          <div className="space-y-xs">
            <h2 className="font-h1 text-h3 text-on-surface">Find your next meal</h2>
            <p className="text-tertiary font-body-md">Personalized by your unique taste profile</p>
          </div>
          <div className="glass-panel p-lg rounded-[24px] shadow-[0_10px_40px_rgba(74,74,74,0.05)] space-y-lg">
            {/* Location */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase">Location</label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-surface-container rounded-xl px-4 py-3 border-none focus:ring-2 focus:ring-primary-container font-body-md text-on-surface"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="Bangalore">Anywhere in Bangalore</option>
                  <option value="Indiranagar">Indiranagar</option>
                  <option value="Koramangala">Koramangala</option>
                  <option value="Whitefield">Whitefield</option>
                  <option value="Jayanagar">Jayanagar</option>
                  <option value="Hsr">HSR Layout</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase">Budget</label>
              <div className="flex gap-sm">
                {["low", "medium", "high"].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBudget(b)}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                      budget === b
                        ? "bg-primary-container text-white font-bold shadow-md"
                        : "border border-outline-variant text-on-surface hover:bg-white"
                    }`}
                  >
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Cuisine */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase">Cuisine Preferences</label>
              <div className="flex flex-wrap gap-xs">
                {["North Indian", "Italian", "Pan-Asian", "Continental"].map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCuisine(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      selectedCuisines.includes(c)
                        ? "border-primary-container bg-primary-container/20 text-primary"
                        : "border-outline-variant bg-white text-on-surface"
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button className="px-4 py-2 rounded-full border border-outline-variant bg-white text-on-surface text-sm">+ Add more</button>
              </div>
            </div>

            {/* Rating Slider */}
            <div className="space-y-xs">
              <div className="flex justify-between items-end">
                <label className="font-label-sm text-label-sm text-outline uppercase">Minimum Rating</label>
                <span className="text-primary font-bold text-lg">{minRating.toFixed(1)}★</span>
              </div>
              <input
                className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer"
                max="5.0"
                min="3.0"
                step="0.1"
                type="range"
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
              />
            </div>

            {/* Text Area */}
            <div className="space-y-xs">
              <label className="font-label-sm text-label-sm text-outline uppercase">Extra cravings...</label>
              <textarea
                className="w-full bg-surface-container border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-container font-body-md placeholder:text-outline/50"
                placeholder="e.g. Needs to be pet-friendly with outdoor seating"
                rows={2}
                value={additionalPrefs}
                onChange={(e) => setAdditionalPrefs(e.target.value)}
              ></textarea>
            </div>

            {/* CTA */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-h3 text-body-lg shadow-[0_10px_20px_rgba(212,175,55,0.3)] active:scale-95 duration-200 transition-transform ${
                loading ? "bg-primary/70 cursor-not-allowed" : "bg-primary-container"
              }`}
            >
              {loading ? "Discovering..." : "Get Recommendations"}
            </button>
            {error && <p className="text-error text-center text-sm">{error}</p>}
          </div>
        </section>

        {/* Results Section */}
        {results && !error && (
          <section className="space-y-lg pb-12">
            <div className="flex items-center justify-between">
              <h3 className="font-h2 text-h3 text-on-surface">Top Matches for You</h3>
              <span className="font-label-sm text-primary uppercase">{results.recommendations?.length || 0} Results</span>
            </div>

            <div className="bg-primary-container/10 border border-primary-container/30 p-md rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🤖</span>
                <span className="font-bold text-primary text-sm">AI Summary</span>
              </div>
              <p className="text-sm text-on-surface/80 leading-relaxed">
                {results.summary}
              </p>
            </div>

            <div className="space-y-lg">
              {results.recommendations?.map((item: any, idx: number) => (
                <article key={idx} className="glass-panel overflow-hidden rounded-[24px] shadow-[0_15px_30px_rgba(0,0,0,0.04)]">
                  <div className="relative h-56 bg-surface-container flex justify-center items-center">
                    {/* Placeholder for real images if added later */}
                    <div className="absolute top-4 left-4 bg-primary-container text-white px-3 py-1 rounded-full flex items-center shadow-sm z-10">
                      <span className="font-bold text-sm">#{item.rank}</span>
                    </div>
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 shadow-sm z-10">
                      <span className="material-symbols-outlined text-[#D4AF37] text-sm" data-weight="fill">star</span>
                      <span className="font-bold text-sm">{item.rating || "4.5"}</span>
                    </div>
                    {/* Simple aesthetic placeholder for restaurant images */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-container/20 to-primary/40 flex items-center justify-center">
                       <span className="text-6xl opacity-50">🍽️</span>
                    </div>
                  </div>
                  <div className="p-lg space-y-md">
                    <div>
                      <h4 className="font-h3 text-lg">{item.restaurant_name}</h4>
                      <div className="flex gap-2 text-sm text-tertiary mt-1">
                        <span>{item.cuisine || "Multi-Cuisine"}</span>
                        <span>•</span>
                        <span className="text-primary font-medium">{item.cost || "$$"}</span>
                        <span>•</span>
                        <span>{location}</span>
                      </div>
                    </div>
                    {/* AI Insight Box */}
                    <div className="bg-secondary-container/20 border border-secondary-fixed-dim/30 p-md rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">✨</span>
                        <span className="font-bold text-secondary text-sm">Why this?</span>
                      </div>
                      <p className="text-sm text-on-surface/80 leading-relaxed">
                        {item.explanation}
                      </p>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <button className="text-primary font-bold text-sm flex items-center gap-1">
                        View Menu <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                      <div className="flex gap-sm">
                        <button
                          onClick={() => submitFeedback("up")}
                          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                            feedback === "up" ? "bg-primary text-white border-primary" : "border-outline-variant hover:bg-surface text-outline"
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">thumb_up</span>
                        </button>
                        <button
                          onClick={() => submitFeedback("down")}
                          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                            feedback === "down" ? "bg-error text-white border-error" : "border-outline-variant hover:bg-surface text-outline"
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">thumb_down</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full h-20 flex justify-around items-center px-6 pb-safe rounded-t-3xl bg-white/80 backdrop-blur-[40px] border-t border-white/20 shadow-[0_-10px_40px_rgba(74,74,74,0.08)] z-50">
        <button className="flex flex-col items-center justify-center text-[#D4AF37] font-bold active:scale-90 duration-300">
          <span className="material-symbols-outlined" data-weight="fill">explore</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-tighter mt-1">Discover</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 active:scale-90 duration-300 hover:text-[#D4AF37] transition-colors">
          <span className="material-symbols-outlined">bookmark</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-tighter mt-1">Saved</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 active:scale-90 duration-300 hover:text-[#D4AF37] transition-colors">
          <span className="material-symbols-outlined">restaurant</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-tighter mt-1">Taste Profile</span>
        </button>
        <button className="flex flex-col items-center justify-center text-slate-400 active:scale-90 duration-300 hover:text-[#D4AF37] transition-colors">
          <span className="material-symbols-outlined">person</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-medium uppercase tracking-tighter mt-1">Account</span>
        </button>
      </nav>

      {/* Toasts */}
      <div className="fixed bottom-24 right-4 z-50 space-y-2">
        {toasts.map((msg, i) => (
          <div key={i} className="bg-[#D4AF37] text-white px-4 py-2 rounded shadow-lg animate-fade-in">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
