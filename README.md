# Pitch Intelligence Command Center — React App

Game-day pitch charting interface for youth softball coaching.

## Setup

### 1. Install dependencies
```bash
cd charting_app
npm install
```

### 2. Add Supabase credentials
Create `.env.local` in the `charting_app/` folder:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
These are the same credentials used in the Streamlit app.

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:5173

### 4. Deploy to Vercel (free)
1. Push this folder to GitHub (inside your existing `softball-tracker` repo)
2. Go to vercel.com → New Project → Import from GitHub
3. Set **Root Directory** to `charting_app`
4. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Deploy — takes ~2 minutes

## Folder structure
```
charting_app/
├── src/
│   ├── App.jsx              # All game state + wiring
│   ├── components/
│   │   ├── Header.jsx       # Scoreboard + inning
│   │   ├── LeftPanel.jsx    # Count, bases, batter, signal feed
│   │   ├── CenterPanel.jsx  # Zone grid, pitch pills, sequence strip
│   │   ├── RightPanel.jsx   # AI recommendations, effectiveness
│   │   └── BottomConsole.jsx # Outcome buttons, RECORD PITCH
│   └── lib/
│       ├── supabase.js      # Supabase client
│       ├── db.js            # All database queries
│       └── analytics.js     # Stats, recommendations, signals
├── .env.example
├── .gitignore               # Keeps .env.local out of GitHub
├── index.html
├── package.json
└── vite.config.js
```

## How to use game day
1. Open the app on your tablet
2. Select your team + start/resume a game
3. Opponent lineup loads automatically from the database (enter it via Streamlit roster tab beforehand)
4. Select: **zone** → **pitch type** → **outcome** → tap **RECORD PITCH**
5. Lineup auto-advances after each PA-ending outcome
6. AI recommendations and signal feed update in real time
