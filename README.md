# TS-8 Capital — Portfolio Dashboard

A personal portfolio tracking dashboard built with Next.js and React.

## What's Inside

- **TS-8 Fund tab** — Your main investment fund with holdings, sector allocation pie chart, benchmark performance chart, and executed trades log
- **Daytrading tab** — Separate portfolio tracking for short-term trades
- **Thesis / Analyst tab** — Investment memo storage for documenting your thesis before every trade
- **Fidelity paste import** — Copy/paste trade activity directly from Fidelity's activity page
- **Persistent storage** — All data saves in your browser's localStorage

---

## How to Deploy (Step by Step)

### Prerequisites

You need two things installed on your computer:

1. **Node.js** — Download from https://nodejs.org (get the LTS version)
2. **Git** — Download from https://git-scm.com

To check if you already have them, open Terminal (Mac) or Command Prompt (Windows) and type:
```
node --version
git --version
```

If both return version numbers, you are good to go.

### Step 1: Set Up the Project Locally

Open your terminal and navigate to wherever you want the project folder:

```bash
cd ~/Desktop
```

Copy this entire `ts8-capital` folder to your Desktop (or wherever you prefer).

Then install the dependencies:

```bash
cd ts8-capital
npm install
```

Test it locally:

```bash
npm run dev
```

Open your browser to `http://localhost:3000` — you should see the dashboard.

### Step 2: Push to GitHub

1. Go to https://github.com and create a free account (if you don't have one)
2. Click the **+** icon in the top right and select **New repository**
3. Name it `ts8-capital`
4. Keep it **Public** (needed for free Vercel hosting, and it looks good on your profile)
5. Do NOT check "Add a README" (you already have one)
6. Click **Create repository**

Back in your terminal:

```bash
git init
git add .
git commit -m "Initial commit: TS-8 Capital portfolio dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ts8-capital.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Deploy on Vercel

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New Project**
3. It will show your GitHub repos — select **ts8-capital**
4. Leave all settings as default (Vercel auto-detects Next.js)
5. Click **Deploy**

In about 60 seconds, Vercel will give you a live URL like:
```
https://ts8-capital.vercel.app
```

That is your portfolio website. You can share that link with anyone.

### Step 4: Custom Domain (Optional, Later)

If you want something like `ts8capital.com`:
1. Buy a domain from Namecheap, Google Domains, or Cloudflare (~$10/year)
2. In Vercel dashboard, go to your project > Settings > Domains
3. Add your domain and follow the DNS instructions

---

## Updating the Site

Any time you want to make changes:

```bash
# Make your edits to the code
git add .
git commit -m "Description of what you changed"
git push
```

Vercel automatically redeploys when you push to GitHub. Changes go live in under a minute.

---

## Project Structure

```
ts8-capital/
├── package.json          # Dependencies and scripts
├── next.config.js        # Next.js configuration
├── src/
│   └── app/
│       ├── globals.css   # Global styles and fonts
│       ├── layout.js     # HTML wrapper and metadata
│       └── page.js       # The entire dashboard application
└── README.md             # This file
```
