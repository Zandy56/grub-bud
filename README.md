<img src="assets/icon.svg" width="64" height="64" alt="">

# Grub Bud

A phone-first meal planner. Pick meals, get one combined shopping list, check things off, and see what else you can make with what's left over.

## What it does

- **Recipes**: save recipes with ingredients and notes. Tap **+ Add** to put a meal on this week's list. Ingredient lists can be pasted in one go ("Paste a list").
- **This Week**: one shopping list built from every chosen meal, with duplicates merged ("Bell peppers: 2 (Stir Fry), 3 (Fajitas)") and grouped by store section. Tap the circle to check an item off. You can add one-off items too (paper towels).
- **What Else?**: other saved recipes ranked by how much of them is already on the list (or in the pantry), with exactly what's still missing. In the recipe editor, tick **All** on an ingredient the recipe uses up completely (a whole tub of sour cream). When that meal is planned, the ingredient doesn't count as a leftover.
- **Pantry** *(optional, turn on in Settings)*: things you check off stay checked from week to week.
- **Prices** *(can be turned off in Settings)*: tap **+ $** on an item to save what it costs and where. There are no stores to begin with; typing a new store name on an item's price screen adds it. The estimate shows a total for each store that has a price for something on this week's list. Stores can be renamed or removed in Settings.
- **Staples**: salt, oil and similar are assumed on hand and left out of recipe matching. Editable in Settings.

Ingredients match by name, ignoring plurals, capitals and prep words, so "Yellow Onions, diced" matches "yellow onion".

## Where the data lives

Everything is stored **on the phone only** (browser local storage), and nothing is sent anywhere. Use **Settings → Save a backup file** now and then; **Restore from a backup** brings it back.

> On iPhone, add the app to the Home Screen (below). Safari can clear data for websites that haven't been opened in a while, but Home Screen apps are kept.

## Installing on her phone

It's a plain static website, so it needs to be hosted somewhere with HTTPS (GitHub Pages works and is free). Then:

- **iPhone**: open the link in Safari → Share → **Add to Home Screen**.
- **Android**: open in Chrome → ⋮ menu → **Add to Home screen** / **Install app**.

It works offline after the first visit.

## Development

No build step: plain HTML, CSS and JavaScript modules.

```sh
npm start          # serve at http://localhost:8080
npm test           # logic unit tests (matching, list building, suggestions, prices)
npm install && npm run test:ui   # clicks through the app in a simulated browser
```

Files:

- `js/logic.js`: matching, list building, suggestions, prices (pure functions, unit tested)
- `js/store.js`: saved state, backup/restore
- `js/app.js`: screens and interactions
- `js/samples.js`: starter recipes (removable in Settings)
- `sw.js`: offline support. **Bump `VERSION` when you change app files.**
