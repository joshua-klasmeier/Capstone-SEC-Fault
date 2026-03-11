#!/usr/bin/env python3
import os
import google.genai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not found in environment variables")
    exit(1)

print("🔑 Using Gemini API Key:", GEMINI_API_KEY[:10] + "..." if GEMINI_API_KEY else "None")

try:
    client = genai.Client(api_key=GEMINI_API_KEY)
    print("\n📋 Available Gemini Models:")
    print("=" * 50)
    
    models = client.models.list()
    
    for model in models:
        print(f"📦 Model: {model.name}")
        if hasattr(model, 'supported_generation_methods'):
            print(f"   Methods: {model.supported_generation_methods}")
        if hasattr(model, 'description'):
            print(f"   Description: {model.description}")
        print("-" * 30)
        
except Exception as e:
    print(f"❌ Error listing models: {e}")
    
    # Try alternative approach
    print("\n🔄 Trying alternative approach...")
    try:
        # Sometimes the list method is different
        models = list(client.models.list())
        print(f"Found {len(models)} models")
        for i, model in enumerate(models):
            print(f"{i+1}. {model}")
    except Exception as e2:
        print(f"❌ Alternative approach also failed: {e2}")
