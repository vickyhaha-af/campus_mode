"""
Vercel serverless entry point for Tech Vista backend.
"""
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the main app
from backend.main import app
from mangum import Mangum

# Wrap for AWS Lambda/Vercel
handler = Mangum(app, lifespan="off")
