// App state, saved to this device's localStorage.
import { ingredientKey, cleanName, prunePlan } from './logic.js';
import { SAMPLE_RECIPES } from './samples.js';

const STORAGE_KEY = 'meal-planner:v1';

export const DEFAULT_STAPLES = [
  'salt', 'pepper', 'black pepper', 'water', 'olive oil', 'vegetable oil', 'cooking spray',
];

function freshState() {
  const state = {
    version: 2,
    recipes: SAMPLE_RECIPES.map((r) => ({ ...r, sample: true })),
    ingredients: {}, // key -> { name, section } (her overrides)
    staples: [...DEFAULT_STAPLES],
    pantry: [],
    prices: {}, // key -> { store -> { price, date } }
    week: emptyWeek(),
    plan: {}, // 'YYYY-MM-DD' -> what's for dinner that day
    settings: { pantryEnabled: false, showPrices: true, stores: [], currentStore: '', hideChecked: false },
  };
  return state;
}

export function emptyWeek() {
  return { recipeIds: [], checked: [], extras: [], stapleNeeds: [] };
}

/** Fill in anything missing from older or imported data. */
function normalize(raw) {
  const base = freshState();
  const s = { ...base, ...raw };
  s.settings = { ...base.settings, ...(raw.settings || {}) };
  s.week = { ...emptyWeek(), ...(raw.week || {}) };
  s.recipes = (raw.recipes || []).filter((r) => r && r.id && r.name);
  s.ingredients = raw.ingredients || {};
  s.staples = raw.staples || base.staples;
  s.pantry = raw.pantry || [];
  s.prices = raw.prices || {};
  s.plan = prunePlan(raw.plan);

  // v1 → v2: sample recipes gain "uses it all" flags. Her own recipes are untouched.
  if ((raw.version || 1) < 2) {
    for (const recipe of s.recipes) {
      const original = recipe.sample && SAMPLE_RECIPES.find((x) => x.id === recipe.id);
      if (!original) continue;
      for (const ing of recipe.ingredients) {
        const match = original.ingredients.find((o) => o.name === ing.name);
        if (match?.usesAll && ing.usesAll === undefined) ing.usesAll = true;
      }
    }
  }
  s.version = base.version;
  return s;
}

let state;
const listeners = new Set();

export function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? normalize(JSON.parse(saved)) : freshState();
  } catch (err) {
    console.error('Could not load saved data', err);
    state = freshState();
  }
  // Record how each ingredient is spelled in her recipes, so new ones match it.
  for (const r of state.recipes) for (const ing of r.ingredients) rememberName(state, ing.name);
  // Ask the browser not to clear this data when space runs low.
  navigator.storage?.persist?.().catch(() => {});
  return state;
}

export function get() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save', err);
    alert('Could not save your changes. The phone may be out of storage space.');
  }
  listeners.forEach((fn) => fn(state));
}

/** Save without redrawing (used while she's typing in the meal plan). */
export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save', err);
  }
}

export function subscribe(fn) {
  listeners.add(fn);
}

/** Change state and save in one step. */
export function update(mutator) {
  mutator(state);
  save();
}

// ---------- Helpers ----------

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const toggleIn = (arr, value) => {
  const i = arr.indexOf(value);
  if (i === -1) arr.push(value);
  else arr.splice(i, 1);
};
export { toggleIn };

/** Remember how she spelled an ingredient, the first time it shows up. */
export function rememberName(s, rawName) {
  const key = ingredientKey(rawName);
  if (!key) return key;
  if (!s.ingredients[key]) s.ingredients[key] = {};
  if (!s.ingredients[key].name) s.ingredients[key].name = cleanName(rawName);
  return key;
}

export function displayName(key) {
  return state.ingredients[key]?.name || key;
}

/** Every ingredient name she's used, for autocomplete. */
export function knownIngredientNames() {
  const names = new Map();
  for (const r of state.recipes) {
    for (const ing of r.ingredients) {
      const key = ingredientKey(ing.name);
      if (key && !names.has(key)) names.set(key, state.ingredients[key]?.name || cleanName(ing.name));
    }
  }
  for (const [key, meta] of Object.entries(state.ingredients)) {
    if (meta.name && !names.has(key)) names.set(key, meta.name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

// ---------- Backup ----------

export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.recipes)) throw new Error('This file is not a meal planner backup.');
  state = normalize(raw);
  save();
}

export function resetAll() {
  state = freshState();
  save();
}
