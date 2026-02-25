import sys
from pathlib import Path

# Vercel runs this file from api/, so add the project root
# to Python's path so we can import main.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app  # noqa: F401 – Vercel detects the ASGI app object
