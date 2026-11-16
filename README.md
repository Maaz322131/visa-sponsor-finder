# UK Visa Sponsor Finder

Search every UK company licensed to sponsor work visas, using the official Home Office register.

## Streamlit version (live app)
`app.py` is a Python/Streamlit version with search, filters, a results table, CSV download and charts.

Run it locally:
```
pip install -r requirements.txt
streamlit run app.py
```
Deploy: [share.streamlit.io](https://share.streamlit.io) → Create app → this repo, branch `main`, main file `app.py`.

## Files
| File | What it does |
|---|---|
| `index.html` | The page layout (header, search boxes, results area) |
| `style.css` | The look: colours, cards, mobile layout, dark mode |
| `app.js` | The logic: loads the CSV, merges duplicates, filters, shows cards, saves favourites |
| `data/sample-sponsors.csv` | Small made-up list for testing |
| `data/sponsors.csv` | **The real list — you add this (Step 2)** |
| `serve.ps1` | A tiny local web server (no install needed) |

## Step 1 — Run it on your computer
Browsers block loading CSV files directly from disk, so you need a local server.

**Option A (easiest in VS Code):** install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

**Option B:** open PowerShell in this folder and run:
```
powershell -ExecutionPolicy Bypass -File serve.ps1
```
Then open http://localhost:8080

## Step 2 — Add the real data
1. Go to https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers
2. Download the CSV file ("Worker and Temporary Worker").
3. Rename it to `sponsors.csv` and put it in the `data` folder.
4. Refresh the page. The yellow "sample data" banner disappears and you see every company.

## Step 3 — Put it online (free)
1. Create a GitHub account and a new repository called `visa-sponsor-finder`.
2. Upload all these files.
3. Go to https://vercel.com or https://netlify.com, sign in with GitHub, import the repo, click Deploy.
4. You get a public link to share on LinkedIn.

## Coming next
- Chart: top 10 cities with the most sponsors
- "Last updated" date
- LinkedIn launch post
