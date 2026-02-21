"""
export_snapshot.py
Run from charting_app root: python export_snapshot.py > snapshot_v010.txt
Produces a single text file with all source code for pasting into a new chat.
"""
import os
import sys

# Force UTF-8 on Windows so special characters don't crash the redirect
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

FILES = [
    'TECHNICAL_SPEC.md',
    'src/index.css',
    'src/lib/supabase.js',
    'src/lib/db.js',
    'src/lib/analytics.js',
    'src/App.jsx',
    'src/components/Header.jsx',
    'src/components/Header.module.css',
    'src/components/MobileLayout.jsx',
    'src/components/LeftPanel.jsx',
    'src/components/CenterPanel.jsx',
    'src/components/RightPanel.jsx',
    'src/components/BottomConsole.jsx',
    'src/components/Scorebook.jsx',
    'src/components/RosterTab.jsx',
]

def safe_print(text):
    print(text.encode('utf-8', errors='replace').decode('utf-8'))

safe_print("=" * 80)
safe_print("PITCH INTELLIGENCE -- FULL SOURCE SNAPSHOT")
safe_print("Paste this into a new Claude chat to continue development")
safe_print("=" * 80)
safe_print("")

for filepath in FILES:
    filepath_os = filepath.replace('/', os.sep)
    if not os.path.exists(filepath_os):
        safe_print(f"# MISSING: {filepath}")
        continue
    ext = filepath.split('.')[-1]
    lang = {'jsx': 'jsx', 'js': 'javascript', 'css': 'css', 'md': 'markdown'}.get(ext, '')
    safe_print(f"## FILE: {filepath}")
    safe_print(f"```{lang}")
    with open(filepath_os, 'r', encoding='utf-8') as f:
        safe_print(f.read())
    safe_print("```")
    safe_print("")

safe_print("=" * 80)
safe_print("END SNAPSHOT")
safe_print("=" * 80)
