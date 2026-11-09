import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ingredientKey, cleanName, guessSection, buildList, isChecked,
  suggestRecipes, parsePrice, cheapest, estimateTotals, planWeeks, prunePlan,
} from '../js/logic.js';

test('ingredient keys match plural, case and prep variations', () => {
  assert.equal(ingredientKey('Yellow Onions, diced'), ingredientKey('yellow onion'));
  assert.equal(ingredientKey('Tomatoes'), 'tomato');
  assert.equal(ingredientKey('Berries'), 'berry');
  assert.equal(ingredientKey('fresh cilantro'), 'cilantro');
  assert.equal(ingredientKey('Large Eggs'), 'egg');
  assert.equal(ingredientKey('bell peppers (any color)'), 'bell pepper');
  assert.equal(ingredientKey('hummus'), 'hummus');
  assert.equal(ingredientKey('asparagus'), 'asparagus');
  assert.equal(ingredientKey('boneless skinless chicken breasts'), 'chicken breast');
  assert.equal(ingredientKey('   '), '');
});

test('cleanName drops prep notes but keeps the words the user typed', () => {
  assert.equal(cleanName('Yellow Onion, diced'), 'Yellow Onion');
  assert.equal(cleanName('Rice (jasmine)'), 'Rice');
  assert.equal(ingredientKey('Salt to taste'), 'salt');
  assert.equal(cleanName('Cilantro, optional'), 'Cilantro');
});

test('sections: longest keyword wins', () => {
  assert.equal(guessSection('peanut butter'), 'Sauces & Condiments');
  assert.equal(guessSection('coconut milk'), 'Canned & Jarred');
  assert.equal(guessSection('butter'), 'Dairy & Eggs');
  assert.equal(guessSection('bell pepper'), 'Produce');
  assert.equal(guessSection('black pepper'), 'Spices & Baking');
  assert.equal(guessSection('chicken broth'), 'Canned & Jarred');
  assert.equal(guessSection('chicken thigh'), 'Meat & Seafood');
  assert.equal(guessSection('soy sauce'), 'Sauces & Condiments');
  assert.equal(guessSection('graham cracker'), 'Snacks & Drinks');
  assert.equal(guessSection('frozen pea'), 'Frozen');
  assert.equal(guessSection('mystery thing'), 'Other');
});

const recipes = [
  { id: 'a', name: 'Stir Fry', ingredients: [
    { name: 'Chicken breast', amount: '1 lb' }, { name: 'Bell peppers', amount: '2' },
    { name: 'Onion', amount: '1' }, { name: 'Soy sauce', amount: '3 tbsp' },
    { name: 'Rice', amount: '2 cups' }, { name: 'Salt', amount: '' }] },
  { id: 'b', name: 'Tacos', ingredients: [
    { name: 'Ground beef', amount: '1 lb' }, { name: 'onions', amount: '1' },
    { name: 'Tortillas', amount: '8' }, { name: 'Cheddar', amount: '1 cup' }] },
  { id: 'c', name: 'Fried Rice', ingredients: [
    { name: 'Rice', amount: '' }, { name: 'Eggs', amount: '2' }, { name: 'Soy Sauce', amount: '' },
    { name: 'Onion', amount: '' }, { name: 'Salt', amount: '' }] },
  { id: 'd', name: 'Pancakes', ingredients: [
    { name: 'Flour', amount: '' }, { name: 'Milk', amount: '' }, { name: 'Eggs', amount: '' }] },
  { id: 'e', name: 'Fajitas', ingredients: [
    { name: 'Chicken breast', amount: '' }, { name: 'bell pepper', amount: '' },
    { name: 'tortilla', amount: '' }, { name: 'sour cream', amount: '' }] },
];
const staples = ['salt'];

test('buildList merges duplicate ingredients across meals', () => {
  const week = { recipeIds: ['a', 'b'], checked: [], extras: [{ key: 'paper towel', name: 'Paper towels' }] };
  const list = buildList({ recipes, week, staples });
  const onion = list.find((i) => i.key === 'onion');
  assert.equal(onion.uses.length, 2);
  assert.deepEqual(onion.uses.map((u) => u.recipe), ['Stir Fry', 'Tacos']);
  assert.equal(list.filter((i) => i.key === 'onion').length, 1);
  assert.ok(list.find((i) => i.key === 'salt').staple);
  assert.ok(list.find((i) => i.key === 'paper towel').extra);
  // Sorted with produce first
  assert.equal(list[0].section, 'Produce');
});

test('buildList respects custom section and name overrides', () => {
  const week = { recipeIds: ['a'], checked: [], extras: [] };
  const list = buildList({ recipes, week, ingredients: { rice: { name: 'Jasmine rice', section: 'Other' } } });
  const rice = list.find((i) => i.key === 'rice');
  assert.equal(rice.name, 'Jasmine rice');
  assert.equal(rice.section, 'Other');
});

test('items added by hand are their own rows: no recipe amounts, not staples, checked on their own', () => {
  const recs = [{ id: 'p', name: 'Pasta', ingredients: [{ amount: '2 tbsp', name: 'Olive oil' }, { amount: '1 lb', name: 'Spaghetti' }] }];
  const week = {
    recipeIds: ['p'], checked: [], stapleNeeds: [],
    extras: [{ key: 'olive oil', name: 'Olive oil' }, { key: 'salt', name: 'Salt' }, { key: 'spaghetti', name: 'Spaghetti' }, { key: 'paper towel', name: 'Paper towels' }],
  };
  const list = buildList({ recipes: recs, week, staples: ['olive oil', 'salt'] });
  const rows = (key) => list.filter((i) => i.key === key);

  // A staple a recipe uses: the staple row keeps its amounts, the added row has none.
  const [oilStaple, oilAdded] = [rows('olive oil').find((i) => !i.extra), rows('olive oil').find((i) => i.extra)];
  assert.equal(rows('olive oil').length, 2);
  assert.equal(oilStaple.id, 'olive oil');
  assert.equal(oilStaple.staple, true);
  assert.equal(oilStaple.uses[0].amount, '2 tbsp');
  assert.equal(oilAdded.id, 'extra:olive oil');
  assert.equal(oilAdded.staple, false);
  assert.deepEqual(oilAdded.uses, []);
  assert.equal(isChecked(oilStaple, { week }), true, 'the staple still counts as on hand');
  assert.equal(isChecked(oilAdded, { week }), false, 'the added one is to buy');

  // An ordinary ingredient a recipe uses: two rows too, the added one without amounts.
  const [spagRecipe, spagAdded] = [rows('spaghetti').find((i) => !i.extra), rows('spaghetti').find((i) => i.extra)];
  assert.equal(rows('spaghetti').length, 2);
  assert.equal(spagRecipe.uses[0].amount, '1 lb');
  assert.equal(spagRecipe.extra, false);
  assert.deepEqual(spagAdded.uses, []);

  // Checks are separate: checking the recipe row doesn't check the added row, and back.
  const recipeChecked = { ...week, checked: ['spaghetti'] };
  assert.equal(isChecked(spagRecipe, { week: recipeChecked }), true);
  assert.equal(isChecked(spagAdded, { week: recipeChecked }), false);
  const addedChecked = { ...week, checked: ['extra:spaghetti'] };
  assert.equal(isChecked(spagRecipe, { week: addedChecked }), false);
  assert.equal(isChecked(spagAdded, { week: addedChecked }), true);
  // Pantry mode doesn't touch added rows: they're checked for this week only.
  assert.equal(isChecked(spagAdded, { week, pantry: ['spaghetti'], pantryEnabled: true }), false);
  assert.equal(isChecked(spagAdded, { week: addedChecked, pantry: [], pantryEnabled: true }), true);

  // A staple no recipe uses, added by hand: one row, to buy.
  assert.equal(rows('salt').length, 1);
  assert.equal(rows('salt')[0].staple, false);
  assert.equal(isChecked(rows('salt')[0], { week }), false);
  assert.equal(rows('paper towel').length, 1);

  // Every row id is unique.
  assert.equal(new Set(list.map((i) => i.id)).size, list.length);
});

test('isChecked: staples, week checks, and pantry mode', () => {
  const week = { recipeIds: [], checked: ['onion'], stapleNeeds: [] };
  assert.equal(isChecked({ key: 'salt', staple: true }, { week }), true);
  assert.equal(isChecked({ key: 'salt', staple: true }, { week: { ...week, stapleNeeds: ['salt'] } }), false);
  assert.equal(isChecked({ key: 'onion' }, { week }), true);
  assert.equal(isChecked({ key: 'onion' }, { week, pantry: [], pantryEnabled: true }), false);
  assert.equal(isChecked({ key: 'rice' }, { week, pantry: ['rice'], pantryEnabled: true }), true);
});

test('suggestRecipes ranks by fewest missing and skips planned and unrelated meals', () => {
  const week = { recipeIds: ['a', 'b'], checked: [], extras: [] };
  const out = suggestRecipes({ recipes, week, staples });
  const names = out.map((s) => s.recipe.name);
  assert.deepEqual(names, ['Fajitas', 'Fried Rice']); // Pancakes shares nothing
  const fajitas = out[0];
  assert.deepEqual(fajitas.missing, ['sour cream']);
  assert.equal(fajitas.total, 4);
  const friedRice = out[1];
  assert.deepEqual(friedRice.missing, ['Eggs']);
  assert.equal(friedRice.total, 4); // salt excluded
});

test('suggestRecipes counts pantry only when pantry is on', () => {
  const week = { recipeIds: ['a'], checked: [], extras: [] };
  const off = suggestRecipes({ recipes, week, staples, pantry: ['egg'], pantryEnabled: false });
  const on = suggestRecipes({ recipes, week, staples, pantry: ['egg'], pantryEnabled: true });
  assert.deepEqual(off.find((s) => s.recipe.id === 'c').missing, ['Eggs']);
  const fr = on.find((s) => s.recipe.id === 'c');
  assert.deepEqual(fr.missing, []);
  assert.deepEqual(fr.fromPantry, ['Eggs']);
});

test('prices', () => {
  assert.equal(parsePrice('$2.49'), 2.49);
  assert.equal(parsePrice(' 3 '), 3);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('abc'), null);
  const stores = ['Aldi', 'Jewel'];
  assert.deepEqual(cheapest({ Aldi: { price: 2 }, Jewel: { price: 2.5 } }, stores), { store: 'Aldi', price: 2 });
  assert.equal(cheapest({}, stores), null);
  const totals = estimateTotals(
    [{ key: 'a' }, { key: 'b' }],
    { a: { Aldi: { price: 1.1 }, Jewel: { price: 1.5 } }, b: { Aldi: { price: 2.2 } } },
    stores,
  );
  assert.deepEqual(totals, [
    { store: 'Aldi', total: 3.3, priced: 2, unpriced: 0 },
    { store: 'Jewel', total: 1.5, priced: 1, unpriced: 1 },
  ]);
});

import { parseIngredientLine, parseIngredientList } from '../js/logic.js';

test('pasting ingredient lines', () => {
  const p = parseIngredientLine;
  assert.deepEqual(p('2 cups jasmine rice'), { amount: '2 cups', name: 'jasmine rice' });
  assert.deepEqual(p('1 1/2 lb chicken thighs'), { amount: '1 1/2 lb', name: 'chicken thighs' });
  assert.deepEqual(p('1 (15 oz) can black beans, drained'), { amount: '1 (15 oz) can', name: 'black beans, drained' });
  assert.deepEqual(p('• 3 eggs'), { amount: '3', name: 'eggs' });
  assert.deepEqual(p('½ cup of milk'), { amount: '½ cup', name: 'milk' });
  assert.deepEqual(p('Salt to taste'), { amount: '', name: 'Salt to taste' });
  assert.deepEqual(p('2 onions'), { amount: '2', name: 'onions' });
  assert.deepEqual(p('Tortillas'), { amount: '', name: 'Tortillas' });
  assert.equal(p('   '), null);
  assert.equal(parseIngredientList('2 eggs\n\n1 cup flour\n').length, 2);
});

test('"uses it all" ingredients are not counted as leftovers', () => {
  const recs = [
    { id: 'tacos', name: 'Tacos', ingredients: [
      { name: 'Sour cream', amount: '1 tub', usesAll: true }, { name: 'Tortillas', amount: '8' }] },
    { id: 'nachos', name: 'Nachos', ingredients: [
      { name: 'Sour cream', amount: '' }, { name: 'Tortilla chips', amount: '' }] },
    { id: 'wraps', name: 'Wraps', ingredients: [
      { name: 'Tortillas', amount: '' }, { name: 'Sour cream', amount: '' }, { name: 'Lettuce', amount: '' }] },
  ];
  const week = { recipeIds: ['tacos'], checked: [], extras: [] };
  const list = buildList({ recipes: recs, week });
  assert.equal(list.find((i) => i.key === 'sour cream').usedUp, true);
  assert.equal(list.find((i) => i.key === 'tortilla').usedUp, false);
  assert.equal(list.find((i) => i.key === 'sour cream').uses[0].usesAll, true);

  const out = suggestRecipes({ recipes: recs, week });
  // Nachos only overlapped on sour cream, which Tacos uses up, so it drops out.
  assert.deepEqual(out.map((r) => r.recipe.id), ['wraps']);
  assert.deepEqual(out[0].fromList, ['Tortillas']);
  assert.deepEqual(out[0].missing, ['Sour cream', 'Lettuce']);
  assert.deepEqual(out[0].usedUp, ['Sour cream']);

  // It stays used up even if it's in the pantry: this week's meal will use it.
  const withPantry = suggestRecipes({ recipes: recs, week, pantry: ['sour cream'], pantryEnabled: true });
  assert.deepEqual(withPantry[0].usedUp, ['Sour cream']);
});

import { findStore, addStore, removeStore, renameStore, priceCounts, storesForEstimate } from '../js/logic.js';

const storeState = () => ({
  settings: { stores: ['Aldi', 'Jewel'], currentStore: 'Jewel' },
  prices: {
    rice: { Aldi: { price: 2, date: '2026-11-01' }, Jewel: { price: 3, date: '2026-11-05' } },
    gravy: { Jewel: { price: 1.5, date: '2026-10-01' } },
  },
});

test('adding stores: no duplicates, first one becomes current', () => {
  const settings = { stores: [], currentStore: '' };
  assert.equal(addStore(settings, '  Target '), 'Target');
  assert.equal(settings.currentStore, 'Target');
  assert.equal(addStore(settings, 'target'), 'Target');
  assert.equal(addStore(settings, 'Corner   Market'), 'Corner Market');
  assert.equal(addStore(settings, '   '), null);
  assert.deepEqual(settings.stores, ['Target', 'Corner Market']);
  assert.equal(settings.currentStore, 'Target');
  assert.equal(findStore(settings.stores, 'CORNER MARKET'), 'Corner Market');
});

test('removing a store deletes its prices', () => {
  const s = storeState();
  removeStore(s, 'Jewel');
  assert.deepEqual(s.settings.stores, ['Aldi']);
  assert.equal(s.settings.currentStore, 'Aldi');
  assert.deepEqual(Object.keys(s.prices.rice), ['Aldi']);
  assert.equal(s.prices.gravy, undefined);
});

test('renaming a store keeps its prices; renaming onto another merges', () => {
  const s = storeState();
  assert.equal(renameStore(s, 'Jewel', 'Jewel-Osco'), true);
  assert.deepEqual(s.settings.stores, ['Aldi', 'Jewel-Osco']);
  assert.equal(s.settings.currentStore, 'Jewel-Osco');
  assert.equal(s.prices.gravy['Jewel-Osco'].price, 1.5);
  assert.equal(s.prices.gravy.Jewel, undefined);

  // Merge: Jewel-Osco's rice price is newer, so it wins over Aldi's.
  renameStore(s, 'Jewel-Osco', 'aldi');
  assert.deepEqual(s.settings.stores, ['Aldi']);
  assert.equal(s.prices.rice.Aldi.price, 3);
  assert.equal(s.prices.gravy.Aldi.price, 1.5);
  assert.equal(s.settings.currentStore, 'Aldi');
  assert.equal(renameStore(s, 'Aldi', '  '), false);
});

test('price counts and which stores show in the estimate', () => {
  const s = storeState();
  assert.deepEqual(priceCounts(s.prices), { Aldi: 1, Jewel: 2 });
  s.settings.stores.push('Target');
  const items = [{ key: 'rice' }];
  assert.deepEqual(storesForEstimate(items, s.prices, s.settings.stores, 'Target'), ['Aldi', 'Jewel', 'Target']);
  assert.deepEqual(storesForEstimate([{ key: 'gravy' }], s.prices, s.settings.stores, ''), ['Jewel']);
  assert.deepEqual(storesForEstimate([], s.prices, s.settings.stores, ''), []);
});

test('meal plan shows this week and next, Sunday to Saturday', () => {
  const weeks = planWeeks(new Date(2026, 10, 11, 9)); // Wed Nov 11 2026
  assert.equal(weeks.length, 2);
  assert.deepEqual(weeks[0].days.map((d) => d.iso), [
    '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
  assert.equal(weeks[0].days[0].weekday, 'Sun');
  assert.ok(weeks[0].days[3].today);
  assert.equal(weeks[1].days[6].iso, '2026-11-21');
  // Crosses a month and year boundary
  const dec = planWeeks(new Date(2026, 11, 31));
  assert.equal(dec[0].days[0].iso, '2026-12-27');
  assert.equal(dec[1].days[6].iso, '2027-01-09');
});

test('meal plan can start on Monday', () => {
  const wed = planWeeks(new Date(2026, 10, 11), true); // Wed Nov 11 2026
  assert.equal(wed[0].days[0].iso, '2026-11-09');
  assert.equal(wed[0].days[0].weekday, 'Mon');
  assert.equal(wed[0].days[6].weekday, 'Sun');
  // On a Sunday, "this week" is the one that started the Monday before
  const sun = planWeeks(new Date(2026, 10, 15), true);
  assert.equal(sun[0].days[0].iso, '2026-11-09');
  assert.ok(sun[0].days[6].today);
  assert.deepEqual(prunePlan({ '2026-11-08': 'old', '2026-11-09': 'Tacos' }, new Date(2026, 10, 15), true),
    { '2026-11-09': 'Tacos' });
});

test('old plan days are dropped, this week and later are kept', () => {
  const kept = prunePlan({ '2026-11-07': 'old', '2026-11-08': 'Tacos', '2026-11-20': 'Soup', '2026-11-09': '  ' },
    new Date(2026, 10, 11));
  assert.deepEqual(kept, { '2026-11-08': 'Tacos', '2026-11-20': 'Soup' });
});

test('the app version matches the service worker version', async () => {
  const fs = await import('node:fs');
  const { VERSION } = await import('../js/version.js');
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(sw.match(/VERSION = '([^']+)'/)[1], VERSION, 'bump VERSION in both sw.js and js/version.js');
  assert.ok(sw.includes("'js/version.js'"), 'sw.js keeps js/version.js for offline use');
});
