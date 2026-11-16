// =============================================================
// UK Visa Sponsor Finder
// Reads the Home Office sponsor list (CSV), lets users search it.
// =============================================================

const REAL_FILE = 'data/sponsors.csv';          // the real list you download (Step 2)
const SAMPLE_FILE = 'data/sample-sponsors.csv'; // small made-up list for testing
const PAGE_SIZE = 50;                           // how many cards to show at a time

let companies = []; // every company (grouped)
let filtered = [];  // companies that match the current filters
let shown = 0;      // how many of "filtered" are on screen
let favourites = loadFavourites();

// Grab the page elements we need
const $ = (id) => document.getElementById(id);
const searchBox = $('search');
const cityBox = $('city');
const routeSelect = $('route');
const aOnly = $('aOnly');
const favOnly = $('favOnly');
const results = $('results');
const count = $('count');
const loadMoreBtn = $('loadMore');
const banner = $('banner');

// ---------- 1. Load the data ----------
async function start() {
  // Try the real file first; if it isn't there, use the sample file.
  let file = REAL_FILE;
  const check = await fetch(REAL_FILE, { method: 'HEAD' }).catch(() => null);
  if (!check || !check.ok) {
    file = SAMPLE_FILE;
    banner.hidden = false;
    banner.textContent = 'Showing SAMPLE data. Download the real sponsor list from GOV.UK and save it as data/sponsors.csv to see every company.';
  }

  Papa.parse(file, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      companies = groupRows(result.data);
      fillRouteDropdown();
      applyFilters();
    },
    error: () => {
      count.textContent = 'Could not load the sponsor list. Are you running a local server? (See README)';
    },
  });
}

// The CSV has one row per company PER visa route.
// We merge those rows so each company appears once.
function groupRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const name = (row['Organisation Name'] || '').trim();
    if (!name) continue;
    const city = tidy(row['Town/City']);
    const key = (name + '|' + city).toLowerCase();

    if (!map.has(key)) {
      map.set(key, { id: key, name, city, county: tidy(row['County']), routes: new Set(), ratings: new Set() });
    }
    const company = map.get(key);
    if (row['Route']) company.routes.add(row['Route'].trim());
    if (row['Type & Rating']) company.ratings.add(row['Type & Rating'].trim());
  }

  return [...map.values()].map((c) => ({
    ...c,
    routes: [...c.routes].sort(),
    aRated: [...c.ratings].some((r) => r.includes('(A')), // "A rating", "A (Premium)" etc.
    nameLower: c.name.toLowerCase(),
    placeLower: (c.city + ' ' + c.county).toLowerCase(),
  }));
}

// "  LONDON " -> "London"
function tidy(text) {
  return (text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// Put every visa route into the dropdown, most common first
function fillRouteDropdown() {
  const tally = {};
  companies.forEach((c) => c.routes.forEach((r) => (tally[r] = (tally[r] || 0) + 1)));
  Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .forEach(([route, n]) => {
      const opt = document.createElement('option');
      opt.value = route;
      opt.textContent = `${route} (${n.toLocaleString()})`;
      routeSelect.appendChild(opt);
    });
}

// ---------- 2. Filter ----------
function applyFilters() {
  const q = searchBox.value.trim().toLowerCase();
  const place = cityBox.value.trim().toLowerCase();
  const route = routeSelect.value;

  filtered = companies.filter((c) =>
    (!q || c.nameLower.includes(q)) &&
    (!place || c.placeLower.includes(place)) &&
    (!route || c.routes.includes(route)) &&
    (!aOnly.checked || c.aRated) &&
    (!favOnly.checked || favourites.has(c.id))
  );

  shown = 0;
  results.innerHTML = '';
  showMore();
  count.textContent = `${filtered.length.toLocaleString()} of ${companies.length.toLocaleString()} sponsor companies`;
}

// ---------- 3. Show cards ----------
function showMore() {
  const next = filtered.slice(shown, shown + PAGE_SIZE);
  next.forEach((c) => results.appendChild(makeCard(c)));
  shown += next.length;
  loadMoreBtn.hidden = shown >= filtered.length;
}

function makeCard(c) {
  const card = document.createElement('article');
  card.className = 'card';

  const top = document.createElement('div');
  top.className = 'card-top';

  const title = document.createElement('h2');
  title.textContent = c.name; // textContent keeps it safe from odd characters

  const star = document.createElement('button');
  star.className = 'star' + (favourites.has(c.id) ? ' saved' : '');
  star.textContent = favourites.has(c.id) ? '★' : '☆';
  star.setAttribute('aria-label', 'Save ' + c.name);
  star.addEventListener('click', () => toggleFavourite(c.id, star));

  top.append(title, star);

  const loc = document.createElement('p');
  loc.className = 'location';
  loc.textContent = [c.city, c.county].filter(Boolean).join(', ') || 'Location not listed';

  const tags = document.createElement('div');
  tags.className = 'tags';
  c.routes.forEach((r) => {
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = r;
    tags.appendChild(t);
  });

  const link = document.createElement('a');
  link.className = 'job-link';
  link.href = 'https://www.linkedin.com/jobs/search/?keywords=' +
    encodeURIComponent(c.name) + '&location=' + encodeURIComponent(c.city || 'United Kingdom');
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Find jobs on LinkedIn →';

  card.append(top, loc, tags, link);
  return card;
}

// ---------- 4. Favourites (saved in this browser) ----------
function loadFavourites() {
  try {
    return new Set(JSON.parse(localStorage.getItem('favourites') || '[]'));
  } catch {
    return new Set();
  }
}

function toggleFavourite(id, button) {
  if (favourites.has(id)) favourites.delete(id);
  else favourites.add(id);
  try { localStorage.setItem('favourites', JSON.stringify([...favourites])); } catch {}
  const saved = favourites.has(id);
  button.classList.toggle('saved', saved);
  button.textContent = saved ? '★' : '☆';
  if (favOnly.checked) applyFilters();
}

// ---------- 5. Wire up the controls ----------
let typingTimer;
function onType() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(applyFilters, 200); // wait until the user pauses typing
}
searchBox.addEventListener('input', onType);
cityBox.addEventListener('input', onType);
routeSelect.addEventListener('change', applyFilters);
aOnly.addEventListener('change', applyFilters);
favOnly.addEventListener('change', applyFilters);
loadMoreBtn.addEventListener('click', showMore);

start();
