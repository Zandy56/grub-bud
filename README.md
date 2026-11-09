<img src="assets/icon.svg" width="64" height="64" alt="">

# Grub Bud

A phone-first meal planner. Pick meals, get one combined shopping list, check things off, and see what else you can make with what's left over.

**Open it: https://zandy56.github.io/grub-bud/**

Everyone who opens that link gets their own separate copy. Recipes, lists and prices are kept on each person's phone and never shared.

## What it does

- **Recipes**: save recipes with ingredients and notes. Tap **+ Add** to put a meal on this week's list. Ingredient lists can be pasted in one go ("Paste a list").
- **Plan**: this week and next week, Sunday to Saturday (or Monday to Sunday, set in Settings), with a Lunch and a Dinner box for each day ("Sandwiches", "Beef tacos", "Soup leftovers"). Recipe names are suggested as you type. It saves as you type, and past weeks clear themselves.
- **This Week**: one shopping list built from every chosen meal, with duplicates merged ("Bell peppers: 2 (Stir Fry), 3 (Fajitas)") and grouped by store section. Tap the circle to check an item off; checked items move to a "Checked off" group at the bottom (tap again to put one back). You can add one-off items too (paper towels).
- **What Else?**: other saved recipes ranked by how much of them is already on the list (or in the pantry), with exactly what's still missing. In the recipe editor, tick **All** on an ingredient the recipe uses up completely (a whole tub of sour cream). When that meal is planned, the ingredient doesn't count as a leftover.
- **Pantry** *(optional, turn on in Settings)*: things you check off stay checked from week to week.
- **Prices** *(can be turned off in Settings)*: tap **+ $** on an item to save what it costs and where. There are no stores to begin with; typing a new store name on an item's price screen adds it. The estimate shows a total for each store that has a price for something on this week's list. Stores can be renamed or removed in Settings.
- **Staples**: salt, oil and similar are assumed on hand and left out of recipe matching. Editable in Settings.

Ingredients match by name, ignoring plurals, capitals and prep words, so "Yellow Onions, diced" matches "yellow onion".

## Where the data lives

Everything is stored **on the phone only** (browser local storage), and nothing is sent anywhere. Use **Settings → Save a backup file** now and then; **Restore from a backup** brings it back.

> On iPhone, add the app to the Home Screen (below). Safari can clear data for websites that haven't been opened in a while, but Home Screen apps are kept.

## Installing on a phone

Open **https://zandy56.github.io/grub-bud/**, then:

- **iPhone**: open the link in Safari → Share → **Add to Home Screen**.
- **Android**: open in Chrome → ⋮ menu → **Add to Home screen** / **Install app**.

It works offline after the first visit.

## Publishing changes

The site is served by GitHub Pages from the `main` branch. Pushing to `main` updates it for everyone within a minute or two. Phones get the new version the next time the app is opened with a signal. Run all three test commands before pushing, and bump `VERSION` in `sw.js`.

## Development

No build step: plain HTML, CSS and JavaScript modules.

```sh
npm start          # serve at http://localhost:8080
npm test           # logic unit tests (matching, list building, suggestions, prices)
npm install && npm run test:ui   # clicks through the app in a simulated browser
npm run test:phone               # every screen at phone size in real Chrome; fails if anything is too wide
```

Files:

- `js/logic.js`: matching, list building, suggestions, prices (pure functions, unit tested)
- `js/store.js`: saved state, backup/restore
- `js/app.js`: screens and interactions
- `js/samples.js`: starter recipes (removable in Settings)
- `sw.js`: offline support. **Bump `VERSION` when you change app files.**
