import streamlit as st
import requests
import json
import os
from typing import List, Dict

# Configure page
st.set_page_config(
    page_title="Gourmet Restaurant Recommender",
    page_icon="🍽️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# API endpoint - use Next.js frontend API routes
API_BASE = os.getenv("API_BASE_URL", "https://gourmet-restaurant-recommender.vercel.app")

def main():
    st.title("🍽️ Gourmet Restaurant Recommender")
    st.markdown("*Powered by AI - Find your perfect dining experience*")
    
    # Sidebar for user preferences
    st.sidebar.header("🔍 Your Preferences")
    
    # Location input
    location = st.sidebar.text_input(
        "Location",
        value="Bangalore",
        placeholder="e.g., Bangalore, Delhi, Mumbai",
        help="Enter your preferred city or area"
    )
    
    # Budget selection
    budget = st.sidebar.selectbox(
        "Budget",
        options=["low", "medium", "high"],
        format_func=lambda x: x.capitalize(),
        help="Select your preferred budget range"
    )
    
    # Cuisine selection
    available_cuisines = [
        "North Indian", "South Indian", "Chinese", "Italian", "Mexican",
        "Thai", "Japanese", "Continental", "Fast Food", "Biryani",
        "Cafe", "Desserts", "Beverages", "Street Food", "Mughlai"
    ]
    
    cuisines = st.sidebar.multiselect(
        "Preferred Cuisines",
        options=available_cuisines,
        default=["North Indian"],
        help="Select one or more cuisine types"
    )
    
    # Rating slider
    min_rating = st.sidebar.slider(
        "Minimum Rating",
        min_value=0.0,
        max_value=5.0,
        value=4.0,
        step=0.1,
        help="Minimum restaurant rating you're looking for"
    )
    
    # Additional preferences
    additional_prefs = st.sidebar.multiselect(
        "Additional Preferences",
        options=["family friendly", "quick service", "romantic", "casual", "fine dining"],
        help="Any specific requirements for your dining experience"
    )
    
    # Party type
    party_type = st.sidebar.selectbox(
        "Party Type",
        options=["solo", "couple", "family", "group"],
        format_func=lambda x: x.capitalize(),
        help="Size and type of your dining group"
    )
    
    # Max results
    max_results = st.sidebar.slider(
        "Number of Recommendations",
        min_value=1,
        max_value=20,
        value=8,
        step=1,
        help="How many recommendations would you like?"
    )
    
    # Main content area
    if st.sidebar.button("🚀 Get Recommendations", type="primary"):
        if not location.strip() or not cuisines:
            st.error("❌ Please provide both location and at least one cuisine preference!")
            return
        
        # Show loading state
        with st.spinner("🤖 AI is finding the perfect restaurants for you..."):
            try:
                # Prepare request payload
                payload = {
                    "location": location,
                    "budget": budget,
                    "cuisines": cuisines,
                    "min_rating": min_rating,
                    "additional_preferences": additional_prefs,
                    "party_type": party_type,
                    "max_results": max_results
                }
                
                # Make API request
                response = requests.post(f"{API_BASE}/api/recommend", json=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    display_recommendations(result, payload)
                else:
                    st.error(f"❌ Error: {response.status_code} - {response.text}")
                    
            except requests.exceptions.ConnectionError:
                st.error("❌ Could not connect to the recommendation service. Please ensure the backend is running.")
            except Exception as e:
                st.error(f"❌ An unexpected error occurred: {str(e)}")
    
    # Footer
    st.markdown("---")
    st.markdown("💡 **Tip**: The more specific your preferences, the better the recommendations!")
    st.markdown("🤖 This AI-powered recommender uses advanced language models to understand your preferences.")

def display_recommendations(result: Dict, user_prefs: Dict):
    """Display restaurant recommendations in a nice format"""
    
    st.success(f"🎉 Found {len(result.get('recommendations', []))} great restaurants for you!")
    
    # Show request info
    with st.expander("📋 Your Preferences Summary"):
        st.json(user_prefs)
    
    # Show provider info
    provider = result.get("provider", "AI")
    st.info(f"🤖 Recommendations powered by: {provider}")
    
    recommendations = result.get("recommendations", [])
    
    if not recommendations:
        st.warning("😔 No restaurants found matching your criteria. Try adjusting your preferences!")
        return
    
    # Display each recommendation
    for i, rec in enumerate(recommendations, 1):
        with st.container():
            col1, col2 = st.columns([3, 1])
            
            with col1:
                st.markdown(f"### {i}. {rec.get('name', 'Unknown Restaurant')}")
                
                # Restaurant details
                details = []
                if rec.get('cuisine'):
                    details.append(f"🍴 {rec['cuisine']}")
                if rec.get('rating'):
                    details.append(f"⭐ {rec['rating']}")
                if rec.get('estimated_cost'):
                    details.append(f"💰 {rec['estimated_cost']}")
                if rec.get('location'):
                    details.append(f"📍 {rec['location']}")
                
                st.markdown(" | ".join(details))
                
                # AI explanation
                if rec.get('explanation'):
                    st.markdown(f"**Why you'll like it:** {rec['explanation']}")
            
            with col2:
                # Feedback buttons
                st.markdown("**Was this helpful?**")
                col_up, col_down = st.columns(2)
                
                with col_up:
                    if st.button("👍", key=f"up_{rec.get('id', i)}"):
                        submit_feedback(result.get('request_id'), 'up', rec.get('id', i))
                        st.success("Thanks for the feedback!")
                
                with col_down:
                    if st.button("👎", key=f"down_{rec.get('id', i)}"):
                        submit_feedback(result.get('request_id'), 'down', rec.get('id', i))
                        st.success("Thanks for the feedback!")
            
            st.markdown("---")

def submit_feedback(request_id: str, feedback_type: str, restaurant_id: str):
    """Submit feedback to the API"""
    try:
        payload = {
            "request_id": request_id,
            "feedback_type": feedback_type,
            "comment": f"Feedback for restaurant {restaurant_id}"
        }
        response = requests.post(f"{API_BASE}/api/feedback", json=payload)
        return response.status_code == 200
    except:
        return False

# Add some sample data for demo purposes when API is not available
def show_sample_recommendations():
    """Show sample recommendations when API is not available"""
    st.info("📱 Showing sample recommendations (API not available)")
    
    sample_recs = [
        {
            "name": "Paradise Restaurant",
            "cuisine": "North Indian, Chinese",
            "rating": 4.5,
            "estimated_cost": "₹800 for two",
            "location": "Bangalore",
            "explanation": "Great family-friendly restaurant with excellent North Indian cuisine and good ratings."
        },
        {
            "name": "The Italian Corner",
            "cuisine": "Italian, Continental",
            "rating": 4.2,
            "estimated_cost": "₹1200 for two",
            "location": "Bangalore",
            "explanation": "Perfect for couples seeking authentic Italian food in a romantic setting."
        }
    ]
    
    for i, rec in enumerate(sample_recs, 1):
        st.markdown(f"### {i}. {rec['name']}")
        details = [f"🍴 {rec['cuisine']}", f"⭐ {rec['rating']}", f"💰 {rec['estimated_cost']}", f"📍 {rec['location']}"]
        st.markdown(" | ".join(details))
        st.markdown(f"**Why you'll like it:** {rec['explanation']}")
        st.markdown("---")

if __name__ == "__main__":
    main()
