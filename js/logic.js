// Pure logic: no DOM, no storage. Everything here is unit-tested in tests/.

// ---------- Ingredient names ----------

const PREP_WORDS = new Set([
  'fresh', 'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
  'large', 'small', 'medium', 'boneless', 'skinless', 'ripe', 'cooked',
  'uncooked', 'whole', 'crushed', 'peeled', 'finely', 'roughly',
]);

// Words ending in "s" that are not plurals.
const NOT_PLURAL = new Set([
  'hummus', 'asparagus', 'couscous', 'molasses', 'swiss', 'grits', 'lettuce',
  'citrus', 'bass', 'brussels', 'hops', 'species',
  'series', 'cress', 'watercress', 'octopus', 'floss', 'harissa',
]);

function singular(word) {
  if (word.length <= 3 || NOT_PLURAL.has(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(ches|shes|xes|sses|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ves') && word.length > 4) return word.slice(0, -3) + 'f';
  if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Tidy an ingredient name for display: trims, drops text after a comma. */
export function cleanName(raw) {
  return String(raw ?? '')
    .split(',')[0]
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(to taste|as needed|for serving|for garnish|optional|or more)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matching key for an ingredient. "Yellow Onions, diced" and "yellow onion"
 * produce the same key. Only used for matching, never shown.
 */
export function ingredientKey(raw) {
  const words = cleanName(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s'&-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !PREP_WORDS.has(w));
  if (!words.length) return '';
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(' ');
}

// ---------- Store sections ----------

export const SECTIONS = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery & Bread',
  'Pasta, Rice & Grains',
  'Canned & Jarred',
  'Sauces & Condiments',
  'Spices & Baking',
  'Frozen',
  'Snacks & Drinks',
  'Other',
];

const SECTION_WORDS = [
  ['Frozen', ['frozen', 'ice cream']],
  ['Spices & Baking', ['salt', 'black pepper', 'peppercorn', 'paprika', 'cumin', 'chili powder', 'oregano', 'dried basil', 'thyme', 'cinnamon', 'nutmeg', 'garlic powder', 'onion powder', 'flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'vanilla', 'cornstarch', 'seasoning', 'spice', 'bay lea', 'red pepper flake', 'italian seasoning', 'cocoa', 'chocolate chip', 'curry powder', 'turmeric', 'ground ginger', 'cayenne']],
  ['Meat & Seafood', ['chicken', 'beef', 'pork', 'steak', 'bacon', 'sausage', 'turkey', 'ham', 'shrimp', 'salmon', 'fish', 'tuna steak', 'cod', 'tilapia', 'lamb', 'chorizo', 'pepperoni', 'meatball']],
  ['Dairy & Eggs', ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'butter', 'yogurt', 'cream', 'egg', 'sour cream', 'half and half', 'feta', 'ricotta', 'cottage']],
  ['Bakery & Bread', ['bread', 'bun', 'tortilla', 'pita', 'bagel', 'roll', 'naan', 'croissant', 'english muffin', 'taco shell']],
  ['Pasta, Rice & Grains', ['pasta', 'spaghetti', 'penne', 'macaroni', 'noodle', 'rice', 'quinoa', 'oat', 'couscous', 'lasagna', 'fettuccine', 'ramen', 'cereal', 'breadcrumb', 'panko', 'rolled oat']],
  ['Canned & Jarred', ['canned', 'bean', 'chicken broth', 'beef broth', 'chicken stock', 'vegetable broth', 'cream of mushroom', 'cream of chicken', 'refried bean', 'tomato paste', 'tomato sauce', 'diced tomato', 'crushed tomato', 'broth', 'stock', 'soup', 'tuna', 'corn', 'chickpea', 'coconut milk', 'olive', 'pickle', 'salsa']],
  ['Sauces & Condiments', ['sauce', 'ketchup', 'mustard', 'mayo', 'mayonnaise', 'vinegar', 'oil', 'dressing', 'honey', 'syrup', 'peanut butter', 'jam', 'jelly', 'soy', 'sriracha', 'teriyaki', 'hoisin', 'worcestershire', 'pesto']],
  ['Produce', ['onion', 'garlic', 'pepper', 'tomato', 'potato', 'carrot', 'celery', 'lettuce', 'spinach', 'broccoli', 'cucumber', 'zucchini', 'squash', 'mushroom', 'avocado', 'lemon', 'lime', 'apple', 'banana', 'berry', 'orange', 'grape', 'cilantro', 'parsley', 'basil', 'ginger', 'scallion', 'green onion', 'kale', 'cabbage', 'cauliflower', 'jalapeno', 'pea', 'green bean', 'asparagus', 'herb', 'mint', 'rosemary', 'fruit', 'salad', 'sprout']],
  ['Snacks & Drinks', ['chip', 'cracker', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer', 'popcorn', 'pretzel', 'nut', 'peanut', 'almond', 'cookie']],
];

/**
 * Best-guess store section for an ingredient key. The longest keyword wins,
 * so "peanut butter" beats "butter" and "coconut milk" beats "milk".
 * Keywords match at the start of a word ("ham" won't match "graham").
 */
export function guessSection(key) {
  const k = ` ${key}`;
  let best = { section: 'Other', len: 0 };
  for (const [section, words] of SECTION_WORDS) {
    for (const w of words) {
      if (w.length > best.len && k.includes(` ${w}`)) best = { section, len: w.length };
    }
  }
  return best.section;
}

// ---------- The shopping list ----------

/**
 * Build the combined shopping list for this week's meals plus manual extras.
 * Returns items sorted by section order, then name.
 */
export function buildList({ recipes, week, ingredients = {}, staples = [] }) {
  const stapleSet = new Set(staples);
  const byKey = new Map();
  const chosen = recipes.filter((r) => week.recipeIds.includes(r.id));

  const touch = (key, rawName) => {
    if (!byKey.has(key)) {
      const meta = ingredients[key] || {};
      byKey.set(key, {
        key,
        name: meta.name || cleanName(rawName),
        section: meta.section || guessSection(key),
        uses: [],
        usedUp: false, // a planned meal uses the whole thing, so none is left over
        staple: stapleSet.has(key),
        extra: false,
      });
    }
    return byKey.get(key);
  };

  for (const recipe of chosen) {
    for (const ing of recipe.ingredients) {
      const key = ingredientKey(ing.name);
      if (!key) continue;
      const item = touch(key, ing.name);
      item.uses.push({ recipe: recipe.name, amount: (ing.amount || '').trim(), usesAll: !!ing.usesAll });
      if (ing.usesAll) item.usedUp = true;
    }
  }
  for (const extra of week.extras || []) {
    const item = touch(extra.key, extra.name);
    item.extra = true;
  }

  return [...byKey.values()].sort(
    (a, b) =>
      SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) ||
      a.name.localeCompare(b.name),
  );
}

/** Is a list item checked off? Staples count as checked unless she marked one as needed. */
export function isChecked(item, { week, pantry = [], pantryEnabled = false }) {
  if (item.staple) return !(week.stapleNeeds || []).includes(item.key);
  if (pantryEnabled) return pantry.includes(item.key);
  return (week.checked || []).includes(item.key);
}

// ---------- What else can I make? ----------

/**
 * Rank every recipe not already planned by how much of it is on hand.
 * "On hand" = everything on this week's list, plus pantry (if on), plus staples.
 * Anything a planned meal uses completely ("uses it all") isn't left over, so it
 * counts as missing. Staples are left out of the counts so salt and oil don't
 * inflate scores.
 */
export function suggestRecipes({ recipes, week, ingredients = {}, staples = [], pantry = [], pantryEnabled = false }) {
  const stapleSet = new Set(staples);
  const list = buildList({ recipes, week, ingredients, staples });
  const usedUpKeys = new Set(list.filter((i) => i.usedUp).map((i) => i.key));
  const listKeys = new Set(list.filter((i) => !i.usedUp).map((i) => i.key));
  const pantryKeys = new Set(pantryEnabled ? pantry : []);
  const nameOf = (key, raw) => ingredients[key]?.name || cleanName(raw);

  const results = [];
  for (const recipe of recipes) {
    if (week.recipeIds.includes(recipe.id)) continue;
    const seen = new Set();
    const fromList = [];
    const fromPantry = [];
    const missing = [];
    const usedUp = []; // the subset of missing that this week's meals use up
    for (const ing of recipe.ingredients) {
      const key = ingredientKey(ing.name);
      if (!key || seen.has(key) || stapleSet.has(key)) continue;
      seen.add(key);
      const name = nameOf(key, ing.name);
      if (usedUpKeys.has(key)) {
        missing.push(name);
        usedUp.push(name);
      } else if (listKeys.has(key)) fromList.push(name);
      else if (pantryKeys.has(key)) fromPantry.push(name);
      else missing.push(name);
    }
    const total = fromList.length + fromPantry.length + missing.length;
    if (!total || fromList.length + fromPantry.length === 0) continue;
    results.push({ recipe, fromList, fromPantry, missing, usedUp, have: total - missing.length, total });
  }

  return results.sort(
    (a, b) =>
      a.missing.length - b.missing.length ||
      b.fromList.length - a.fromList.length ||
      b.have / b.total - a.have / a.total ||
      a.recipe.name.localeCompare(b.recipe.name),
  );
}

// ---------- Prices ----------

/** Parse "$2.49", "2.49", "2" → 2.49 / 2. Returns null for blanks or junk. */
export function parsePrice(text) {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function formatPrice(n) {
  return `$${n.toFixed(2)}`;
}

/** Cheapest known price for an item: { store, price } or null. */
export function cheapest(pricesForItem = {}, stores = []) {
  let best = null;
  for (const store of stores) {
    const p = pricesForItem[store];
    if (p && (best === null || p.price < best.price)) best = { store, price: p.price };
  }
  return best;
}

/**
 * Estimated cost per store for the items still to buy.
 * Returns [{ store, total, priced, unpriced }].
 */
export function estimateTotals(items, prices = {}, stores = []) {
  return stores.map((store) => {
    let total = 0;
    let priced = 0;
    for (const item of items) {
      const p = prices[item.key]?.[store];
      if (p) {
        total += p.price;
        priced += 1;
      }
    }
    return { store, total: Math.round(total * 100) / 100, priced, unpriced: items.length - priced };
  });
}

// ---------- Pasting ingredient lists ----------

const UNITS = [
  'cups', 'cup', 'c', 'tablespoons', 'tablespoon', 'tbsp', 'tbs', 'tb', 'teaspoons', 'teaspoon', 'tsp',
  'pounds', 'pound', 'lbs', 'lb', 'ounces', 'ounce', 'oz', 'grams', 'gram', 'g', 'kg', 'ml', 'l', 'liters', 'liter',
  'cans', 'can', 'jars', 'jar', 'packets', 'packet', 'packages', 'package', 'pkg', 'cloves', 'clove',
  'heads', 'head', 'bunches', 'bunch', 'pinch', 'pinches', 'dash', 'dashes', 'slices', 'slice',
  'sticks', 'stick', 'bags', 'bag', 'boxes', 'box', 'handful', 'handfuls', 'pints', 'pint',
  'quarts', 'quart', 'gallon', 'gallons', 'sprigs', 'sprig', 'stalks', 'stalk', 'pieces', 'piece',
];
const UNIT_SET = new Set(UNITS);
const QTY = /^(\d+([./]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+[¼½¾⅓⅔⅛]|a|an|one|two|three|four|five|six|-|–|to)$/i;

/**
 * Split "2 cups jasmine rice" into { amount: '2 cups', name: 'jasmine rice' }.
 * Also handles "1 1/2 lb chicken", "1 (15 oz) can black beans", "- 3 eggs", "Salt to taste".
 */
export function parseIngredientLine(line) {
  let text = String(line).replace(/^[\s•*·▢☐-]+/, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const words = text.split(' ');
  const amount = [];
  let i = 0;
  while (i < words.length - 1 && QTY.test(words[i])) amount.push(words[i++]);
  // A size in parentheses, e.g. "(15 oz)"
  if (amount.length && /^\(/.test(words[i] || '')) {
    while (i < words.length - 1) {
      const w = words[i++];
      amount.push(w);
      if (/\)$/.test(w)) break;
    }
  }
  if (amount.length && i < words.length - 1 && UNIT_SET.has(words[i].toLowerCase().replace(/\.$/, ''))) {
    amount.push(words[i++]);
    if (/^of$/i.test(words[i] || '') && i < words.length - 1) i++;
  }
  return { amount: amount.join(' '), name: words.slice(i).join(' ') };
}

export function parseIngredientList(text) {
  return String(text).split(/\r?\n/).map(parseIngredientLine).filter(Boolean);
}

// ---------- Stores ----------
// These take the app state (or part of it) and change it in place.

const tidyStoreName = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');

/** The saved store with this name, ignoring capitals ("target" finds "Target"), or null. */
export function findStore(stores, name) {
  const wanted = tidyStoreName(name).toLowerCase();
  return stores.find((s) => s.toLowerCase() === wanted) || null;
}

/** Add a store unless it already exists. Returns the store's saved name (or null if blank). */
export function addStore(settings, name) {
  const clean = tidyStoreName(name);
  if (!clean) return null;
  const existing = findStore(settings.stores, clean);
  if (existing) return existing;
  settings.stores.push(clean);
  if (!settings.currentStore) settings.currentStore = clean;
  return clean;
}

/** Remove a store and every price saved for it. */
export function removeStore(state, name) {
  state.settings.stores = state.settings.stores.filter((s) => s !== name);
  for (const [key, byStore] of Object.entries(state.prices)) {
    delete byStore[name];
    if (!Object.keys(byStore).length) delete state.prices[key];
  }
  if (state.settings.currentStore === name) state.settings.currentStore = state.settings.stores[0] || '';
}

/**
 * Rename a store and keep its prices. Renaming onto another saved store merges
 * the two, keeping the newer price where both have one. Returns false if blank.
 */
export function renameStore(state, from, to) {
  const clean = tidyStoreName(to);
  if (!clean) return false;
  if (clean === from) return true;
  const target = findStore(state.settings.stores.filter((s) => s !== from), clean);
  const finalName = target || clean;
  for (const byStore of Object.values(state.prices)) {
    const old = byStore[from];
    if (!old) continue;
    const other = byStore[finalName];
    if (!other || old.date > other.date) byStore[finalName] = old;
    delete byStore[from];
  }
  state.settings.stores = target
    ? state.settings.stores.filter((s) => s !== from)
    : state.settings.stores.map((s) => (s === from ? clean : s));
  if (state.settings.currentStore === from) state.settings.currentStore = finalName;
  return true;
}

/** How many prices are saved for each store: { Aldi: 12, Target: 1 }. */
export function priceCounts(prices) {
  const counts = {};
  for (const byStore of Object.values(prices)) {
    for (const store of Object.keys(byStore)) counts[store] = (counts[store] || 0) + 1;
  }
  return counts;
}

/**
 * Stores worth showing in this week's cost estimate: ones with a price for at
 * least one item on the list, plus the store she's shopping at.
 */
export function storesForEstimate(items, prices, stores, currentStore) {
  return stores.filter((s) => s === currentStore || items.some((i) => prices[i.key]?.[s]));
}

// ---------- Meal plan ----------

/** A local date as "2026-11-09". */
export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The first day (Sunday, or Monday if `mondayFirst`) of the week containing `d`, as a Date. */
function firstDayOfWeek(d, mondayFirst = false) {
  const back = mondayFirst ? (d.getDay() + 6) % 7 : d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

/** The first day of the week containing `d`, as "YYYY-MM-DD". */
export function weekStart(d, mondayFirst = false) {
  return isoDate(firstDayOfWeek(d, mondayFirst));
}

/**
 * This week and next week, Sunday to Saturday (or Monday to Sunday):
 * [{ label, days: [{ iso, weekday: 'Sun', day: 9, month: 'Nov', today }] }, …]
 */
export function planWeeks(now = new Date(), mondayFirst = false) {
  const todayIso = isoDate(now);
  const first = firstDayOfWeek(now, mondayFirst);
  return ['This week', 'Next week'].map((label, w) => ({
    label,
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + i);
      return {
        iso: isoDate(d),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        today: isoDate(d) === todayIso,
      };
    }),
  }));
}

/** Drop plan entries from before this week, so old weeks don't pile up. */
export function prunePlan(plan, now = new Date(), mondayFirst = false) {
  const start = weekStart(now, mondayFirst);
  const kept = {};
  for (const [iso, text] of Object.entries(plan || {})) {
    if (iso >= start && typeof text === 'string' && text.trim()) kept[iso] = text;
  }
  return kept;
}
