#!/usr/bin/env python3
"""Double-click this file to open the MALI-MEC Brief Editor in your browser."""
import sys, os, threading, webbrowser, time, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

# Install Flask silently if missing
try:
    import flask
except ImportError:
    print("Installing Flask...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "flask",
                           "--ignore-installed", "--break-system-packages", "-q"])

sys.path.insert(0, ROOT)
from app.server import app

print("\n" + "=" * 48)
print("  MALI-MEC — Brief Editor")
print("  Opening http://localhost:5050 ...")
print("  Press Ctrl+C to stop.")
print("=" * 48 + "\n")

def _open():
    time.sleep(1.2)
    webbrowser.open("http://localhost:5050")

threading.Thread(target=_open, daemon=True).start()
app.run(debug=False, port=5050, host="127.0.0.1", use_reloader=False)
