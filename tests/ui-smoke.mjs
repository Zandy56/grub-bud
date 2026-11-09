// Clicks through the real app in a simulated browser (jsdom). Run: npm run test:ui
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true });
const { window } = dom;
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
for (const k of ['window', 'document', 'localStorage', 'history', 'navigator', 'HTMLElement', 'Event', 'Blob', 'File', 'URL'])
  def(k, k === 'window' ? window : window[k]);
def('confirm', () => true);
def('alert', (m) => { throw new Error(`alert: ${m}`); });
window.scrollTo = () => {};
def('location', window.location);

const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const click = (el) => { if (!el) throw new Error('missing element'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };
const tick = () => new Promise((r) => setTimeout(r, 30));
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
let failures = 0;
const check = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++; };
const card = (name) => $$('.recipe-card').find((c) => text(c).includes(name));

await import(pathToFileURL(path.join(root, 'js/app.js')).href);

// 1. Recipes tab
check($('#title').textContent === 'Recipes', 'opens on Recipes');
check($$('.recipe-card').length === 8, `shows 8 sample recipes (${$$('.recipe-card').length})`);

// 2. Add two meals
click(card('Chicken Stir Fry').querySelector('[data-action="toggle-week"]'));
click(card('Chicken Fajitas').querySelector('[data-action="toggle-week"]'));
check($('#week-badge').textContent === '2' && !$('#week-badge').hidden, 'badge shows 2 meals');
check(text(card('Chicken Stir Fry')).includes('Added'), 'card shows Added');

// Search
const search = $('#recipe-search');
search.value = 'tortilla';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
check($$('.recipe-card').length === 3, `search by ingredient "tortilla" finds 3 (${$$('.recipe-card').length})`);
search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));

// 3. This Week list
click($('[data-tab="week"]'));
check($('#title').textContent === 'This Week', 'switches to This Week');
const items = () => $$('.item');
const item = (name) => items().find((i) => text(i.querySelector('.iname')) === name);
const pepper = item('Bell peppers');
check(pepper && text(pepper).includes('Chicken Stir Fry') && text(pepper).includes('Chicken Fajitas'), 'bell peppers merged across both meals');
check(items().filter((i) => text(i.querySelector('.iname')) === 'Yellow onion').length === 1, 'yellow onion listed once');
const groups = $$('.group-name').map(text);
check(groups[0] === 'Produce' && groups.at(-1).startsWith('Checked off'), `grouped by section, checked last: ${groups.join(' | ')}`);
check(item('Vegetable oil')?.classList.contains('done'), 'staple (vegetable oil) starts checked');
const groupOf = (name) => text(item(name)?.closest('.list-group')?.querySelector('.group-name') || { textContent: '' });
check(groupOf('Vegetable oil').startsWith('Checked off'), 'a staple you already have sits in Checked off');

// 4. Check off
click(item('Bell peppers').querySelector('.check'));
check(item('Bell peppers').classList.contains('done'), 'checking an item marks it done');
check(groupOf('Bell peppers').startsWith('Checked off'), `a checked item moves to the Checked off group (${groupOf('Bell peppers')})`);
check($$('.group-name').map(text).at(-1).startsWith('Checked off') && $$('.list-group').at(-1).contains(item('Bell peppers')), 'Checked off is the last group on the list');
check(groupOf('Yellow onion') === 'Produce', 'unchecked produce stays in Produce');
click(item('Bell peppers').querySelector('.check'));
check(groupOf('Bell peppers') === 'Produce' && !item('Bell peppers').classList.contains('done'), 'unchecking puts it back in its section');
click(item('Bell peppers').querySelector('.check'));
check(text($$('.section-title').find((e) => text(e).startsWith('Shopping list'))).includes('2/'), 'progress count updates');

// 5. Extra item
$('#add-item').focus();
$('#add-item').value = 'Paper towels';
$('#add-item-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check(item('Paper towels') && text(item('Paper towels')).includes('Added by you'), 'manual item added');
check(window.document.activeElement?.id === 'add-item', 'keyboard stays on the add field');

// 5b. A staple added by hand is its own row to buy; the staple row stays as it was
const oilRows = () => items().filter((i) => text(i.querySelector('.iname')) === 'Vegetable oil');
check(oilRows().length === 1 && oilRows()[0].classList.contains('done'), 'vegetable oil is on the list once, as a staple you have');
$('#add-item').value = 'Vegetable oil';
$('#add-item-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
const boughtOil = () => oilRows().find((r) => !r.classList.contains('done') || text(r).includes('Added by you'));
const stapleOil = () => oilRows().find((r) => r !== boughtOil());
check(oilRows().length === 2, `adding a staple by hand gives it its own row (${oilRows().length})`);
check(boughtOil() && !boughtOil().classList.contains('done') && text(boughtOil()).includes('Added by you'), 'the added one is to buy, marked Added by you');
check(boughtOil() && !/\d|Fajitas|Stir Fry/.test(text(boughtOil().querySelector('.uses'))), 'the added one has no amount or recipe');
check(!text(boughtOil().closest('.list-group').querySelector('.group-name')).startsWith('Checked off'), 'the added one sits in its store section, not Checked off');
check(stapleOil() && stapleOil().classList.contains('done') && /Stir Fry|Fajitas/.test(text(stapleOil())), 'the staple row keeps its recipes and stays checked');
click(boughtOil().querySelector('.check'));
check(oilRows().every((r) => r.classList.contains('done')) && oilRows().length === 2, 'checking the added one checks only it');
const savedWeek = JSON.parse(window.localStorage.getItem('meal-planner:v1')).week;
check(savedWeek.checked.includes('vegetable oil') && !savedWeek.stapleNeeds.includes('vegetable oil'), 'its check is saved apart from the staple');
click(oilRows().find((r) => text(r).includes('Added by you')).querySelector('.check'));
$('#add-item').value = 'Vegetable oil';
$('#add-item-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check(oilRows().length === 2, 'adding it a second time does not add a third row');
click(boughtOil().querySelector('.body'));
check(!$('#item-staple') && text($('#sheet-root')).includes('staple you added'), 'its sheet explains it instead of offering the staple switch');
click($('[data-action="remove-extra"]'));
await tick(); // the sheet closes through history.back()
check(oilRows().length === 1 && oilRows()[0].classList.contains('done') && JSON.parse(window.localStorage.getItem('meal-planner:v1')).staples.includes('vegetable oil'), 'removing it leaves the staple as it was');
$('#add-item').value = 'Bell peppers';
$('#add-item-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check(items().filter((i) => text(i.querySelector('.iname')) === 'Bell peppers').length === 1, 'an ordinary item already on the list is still not added twice');

// 6. Prices: no stores to start; stores get added from the price screen
const settingsNow = () => JSON.parse(window.localStorage.getItem('meal-planner:v1') || '{"settings":{}}').settings;
check(!$('.store-picker') && text($('#view')).includes('Tap the + $'), 'no stores yet: shows a hint instead of totals');
click(item('Rice').querySelector('.tag'));
await tick();
check($('#sheet-title')?.textContent === 'Rice', 'price sheet opens');
check(!$('.price-input') && window.document.activeElement?.classList.contains('ns-name'), 'no store rows yet; focus on the store name');
check(text($('[data-action="add-new-store-row"]')) === '+ Another store', 'offers "+ Another store"');
$('.ns-price').value = '2.49';
let alerted = '';
def('alert', (m) => { alerted = m; });
click($('[data-action="save-item"]'));
check(alerted.includes('Which store') && $('.sheet'), 'a price with no store asks which store');
def('alert', (m) => { throw new Error(`alert: ${m}`); });
$('.ns-name').value = 'Aldi';
click($('[data-action="add-new-store-row"]'));
check($$('.new-store-row').length === 2 && window.document.activeElement === $$('.ns-name')[1], 'second store row added and focused');
$$('.ns-name')[1].value = 'jewel';
$$('.ns-price')[1].value = '$3.19';
click($('[data-action="save-item"]'));
await tick();
check(!$('.sheet'), 'sheet closes after save');
check(settingsNow().stores.join() === 'Aldi,jewel' && settingsNow().currentStore === 'Aldi', 'two stores added in one go; first becomes current');
check(text(item('Rice').querySelector('.tag')) === '$2.49', 'tag shows Aldi price');
let totals = $$('.store-picker [data-action="pick-store"]').map(text);
check(totals.length === 2 && totals[0].includes('~$2.49') && totals[1].includes('~$3.19'), `store totals: ${totals.join(' / ')}`);
click($$('.store-picker [data-action="pick-store"]')[1]);
check(text(item('Rice').querySelector('.tag')) === '$3.19', 'switching store shows Jewel price');
click($$('.store-picker [data-action="pick-store"]')[0]);

click(item('Rice').querySelector('.tag'));
await tick();
check($$('.price-input').map((i) => i.dataset.store).join() === 'Aldi,jewel', 'reopening shows both stores, cheapest first');
check(window.document.activeElement?.dataset.store === 'Aldi', 'focus on the current store');
click($('[data-action="close-sheet"]'));
await tick();

// Beef gravy at Target
$('#add-item').focus();
$('#add-item').value = 'Beef gravy';
$('#add-item-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
click(item('Beef gravy').querySelector('.tag'));
await tick();
check($$('.price-input').map((i) => i.dataset.store).join() === 'Aldi', 'current store row shown');
check($$('[data-action="add-price-row"]').map(text).join() === '+ jewel', `other saved stores offered as buttons: ${$$('[data-action="add-price-row"]').map(text).join()}`);
click($('[data-action="add-price-row"][data-store="jewel"]'));
check($$('.price-input').map((i) => i.dataset.store).join() === 'Aldi,jewel' && !$('[data-action="add-price-row"]'), 'tapping + jewel adds a jewel row');
check(window.document.activeElement?.dataset.store === 'jewel', 'focus on the new jewel row');
click($('[data-action="add-new-store-row"]'));
$('.ns-name').value = 'Target';
$('.ns-price').value = '2.79';
click($('[data-action="save-item"]'));
await tick();
check(text(item('Beef gravy').querySelector('.tag')) === '$2.79Target', `gravy shows Target price: ${text(item('Beef gravy').querySelector('.tag'))}`);
totals = $$('.store-picker [data-action="pick-store"]').map(text);
check(totals.length === 3 && totals[2].includes('Target'), `Target joins the estimate: ${totals.join(' / ')}`);

// Settings: rename and remove stores
click($('[data-action="open-settings"]'));
await tick();
const { VERSION: appVersion } = await import(pathToFileURL(path.join(root, 'js/version.js')).href);
check(text($('#app-version')) === appVersion && !!$('[data-action="update-app"]'), `Settings shows the version (${text($('#app-version'))}) and a Get latest version button`);
check($$('.store-row').map(text).join(' | ').includes('jewel1 price'), `store rows show price counts: ${$$('.store-row').map(text).join(' | ')}`);
def('prompt', () => 'Jewel');
click($('[data-action="rename-store"][data-value="jewel"]'));
check(settingsNow().stores.join() === 'Aldi,Jewel,Target', 'renamed jewel → Jewel');
check(JSON.parse(window.localStorage.getItem('meal-planner:v1')).prices.rice.Jewel.price === 3.19, 'rename kept the price');
click($('[data-action="remove-store"][data-value="Target"]'));
check(settingsNow().stores.join() === 'Aldi,Jewel', 'Target removed');
check(!JSON.parse(window.localStorage.getItem('meal-planner:v1')).prices['beef gravy'], 'Target prices removed with it');
click($('[data-action="close-sheet"]'));
await tick();
check($$('.store-picker [data-action="pick-store"]').length === 2, 'estimate back to two stores');

// "+ Store" button on the estimate: add a new store, or pick a saved one
check(!!$('.store-picker [data-action="choose-store"]'), 'estimate has a + Store button');
click($('.store-picker [data-action="choose-store"]'));
await tick();
check($('#sheet-title')?.textContent === 'Where are you shopping?', 'store chooser opens');
check($$('[data-action="set-store"]').map(text).join() === '✓ Aldi,Jewel', `lists saved stores: ${$$('[data-action="set-store"]').map(text).join()}`);
$('#new-store-name').value = 'Corner Market';
$('#choose-store-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await tick();
check(!$('.sheet') && settingsNow().stores.join() === 'Aldi,Jewel,Corner Market', 'new store added from the estimate');
check(settingsNow().currentStore === 'Corner Market', 'new store becomes the current store');
check($$('.store-picker [data-action="pick-store"]').map(text).some((t) => t.startsWith('Corner Market')), 'current store shows in the estimate even with no prices');
click($('.store-picker [data-action="choose-store"]'));
await tick();
click($('[data-action="set-store"][data-store="Jewel"]'));
await tick();
check(!$('.sheet') && settingsNow().currentStore === 'Jewel', 'picking a saved store sets it as current');

// Settings: add a store there too
click($('[data-action="open-settings"]'));
await tick();
$('#add-store').focus();
$('#add-store').value = 'Costco';
$('#add-store-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
check(settingsNow().stores.includes('Costco') && $$('.store-row').some((r) => text(r).startsWith('Costco')), 'store added from Settings');
click($('[data-action="close-sheet"]'));
await tick();
click($$('.store-picker [data-action="pick-store"]')[0]);

// 7. What Else
click($('[data-tab="else"]'));
const sugg = $$('.suggestion');
check(sugg.length > 0, `What Else shows ${sugg.length} suggestions`);
console.log('      ' + sugg.map((s) => `${text(s.querySelector('h3'))} [${text(s.querySelector('.score'))}]`).join('; '));
check(!sugg.some((s) => /Stir Fry|Fajitas/.test(text(s.querySelector('h3')))), 'planned meals are not suggested');
const quesadillas = sugg.find((s) => text(s).includes('Quesadillas'));
check(quesadillas && text(quesadillas).includes('Chicken breast (used up this week)'),
  `chicken breast is used up, not leftover: ${quesadillas && text(quesadillas.querySelector('dl'))}`);
check(quesadillas && !/Left over from this week:[^N]*Chicken breast/.test(text(quesadillas)), 'used-up item not listed as leftover');
click($('[data-tab="week"]'));
check(text(item('Chicken breast')).includes('uses all'), `list shows "uses all": ${text(item('Chicken breast').querySelector('.uses'))}`);
click($('[data-tab="else"]'));

// 8. Pantry on
click($('[data-action="open-settings"]'));
await tick();
const pantrySwitch = $('[data-setting="pantryEnabled"]');
pantrySwitch.checked = true;
pantrySwitch.dispatchEvent(new window.Event('change', { bubbles: true }));
check(!$('#pantry-tab').hidden, 'Pantry tab appears');
check($('[data-setting="pantryEnabled"]').checked, 'settings sheet redraws with pantry on');
click($('[data-action="close-sheet"]'));
await tick();
click($('#pantry-tab'));
check($$('.pantry-item').some((p) => text(p).includes('Bell peppers')), 'checked item moved into pantry');
click($('[data-tab="week"]'));
check(item('Bell peppers').classList.contains('done'), 'still checked on the list with pantry on');

// 9. New recipe with pasted list
click($('[data-tab="recipes"]'));
click($('[data-action="new-recipe"]'));
await tick();
$('#r-name').value = 'Pepper Pasta';
click($('[data-action="toggle-paste"]'));
$('#paste-text').value = '1 lb penne\n2 bell peppers, sliced\n1/2 cup parmesan cheese\nSalt to taste';
click($('[data-action="apply-paste"]'));
const rows = $$('.ing-row').map((r) => `${r.querySelector('.ing-amt').value}|${r.querySelector('.ing-name').value}`);
check(rows.length === 4 && rows[1] === '2|bell peppers, sliced', `pasted rows: ${rows.join(' ; ')}`);
check($$('.ing-row .ing-all').length === 4, 'every ingredient row has an All toggle');
$$('.ing-row')[0].querySelector('.ing-all').checked = true; // uses the whole box of penne
click($('[data-action="save-recipe"]'));
await tick();
check($$('.recipe-card').length === 9 && card('Pepper Pasta'), 'new recipe saved');
const savedPasta = JSON.parse(window.localStorage.getItem('meal-planner:v1')).recipes.find((r) => r.name === 'Pepper Pasta');
check(savedPasta.ingredients[0].usesAll === true && !savedPasta.ingredients[1].usesAll, 'All toggle saved on the right ingredient');
click(card('Pepper Pasta').querySelector('.info'));
await tick();
check(text($('.ing-view li')).includes('uses all'), 'recipe view shows "uses all"');
click($('[data-action="close-sheet"]'));
await tick();
click($('[data-tab="else"]'));
const pp = $$('.suggestion').find((s) => text(s).includes('Pepper Pasta'));
check(pp && text(pp).includes('Bell peppers') && text(pp).includes('Parmesan cheese'), `new recipe matched via bell peppers: ${pp && text(pp.querySelector('dl'))}`);

// 10. Unsaved edits prompt
click($('[data-tab="recipes"]'));
click(card('Pepper Pasta').querySelector('.info'));
await tick();
click($('[data-action="edit-recipe"]'));
await tick();
let asked = false;
def('confirm', () => { asked = true; return false; });
$('#r-name').value = 'Changed';
click($('[data-action="close-sheet"]'));
await tick();
check(asked && $('.sheet'), 'asks before discarding unsaved edits');
def('confirm', () => true);
click($('[data-action="close-sheet"]'));
await tick();
check(!$('.sheet'), 'closes after confirming');

// 11. Saved
const saved = JSON.parse(window.localStorage.getItem('meal-planner:v1'));
check(saved.recipes.length === 9 && saved.prices.rice.Aldi.price === 2.49 && saved.settings.pantryEnabled, 'everything persisted to storage');

// 12. New week
click($('[data-tab="week"]'));
click($('[data-action="new-week"]'));
check(items().length === 0 && $('#week-badge').hidden, 'new week clears the list');

// 12b. Meal plan
click($('[data-tab="plan"]'));
check($('#title').textContent === 'Meal Plan', 'switches to Meal Plan');
const dinners = () => $$('.plan-input[data-meal="dinner"]');
const lunches = () => $$('.plan-input[data-meal="lunch"]');
check(dinners().length === 14 && lunches().length === 14, `plan shows lunch and dinner for 14 days (${lunches().length}/${dinners().length})`);
check($$('.plan-day').every((d) => d.querySelectorAll('.plan-input').length === 2 && text(d).includes('Lunch') && text(d).includes('Dinner')), 'each day has a Lunch and a Dinner box');
check($$('.plan-day.today').length === 1, 'today is highlighted');
const typeIn = (el, value) => { el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const firstDay = dinners()[0];
typeIn(firstDay, 'Beef tacos');
typeIn(dinners()[13], 'Soup leftovers');
check(document.activeElement !== null && dinners()[0] === firstDay, 'typing does not redraw the page (keyboard stays up)');
const savedPlan = JSON.parse(window.localStorage.getItem('meal-planner:v1')).plan;
check(savedPlan[firstDay.dataset.date] === 'Beef tacos' && Object.keys(savedPlan).length === 2, 'plan saved as the user types');
typeIn(lunches()[0], 'Sandwiches');
const savedLunch = JSON.parse(window.localStorage.getItem('meal-planner:v1')).lunch;
const savedDinner = JSON.parse(window.localStorage.getItem('meal-planner:v1')).plan;
check(savedLunch[firstDay.dataset.date] === 'Sandwiches' && Object.keys(savedLunch).length === 1 && savedDinner[firstDay.dataset.date] === 'Beef tacos', 'lunch saves separately from dinner on the same day');
typeIn(dinners()[13], '');
check(Object.keys(JSON.parse(window.localStorage.getItem('meal-planner:v1')).plan).length === 1, 'clearing a day removes it');
click($('[data-tab="recipes"]'));
click($('[data-tab="plan"]'));
check(dinners()[0].value === 'Beef tacos', 'plan is still there after switching tabs');
check(lunches()[0].value === 'Sandwiches' && lunches()[1].value === '', 'lunch is still there after switching tabs');
check($$('#meal-names option').some((o) => o.value === 'Beef Tacos'), 'recipe names are suggested');
check(text($('.plan-date')).startsWith('Sun'), 'plan starts on Sunday by default');
const nextSunday = dinners()[7]; // shown whether the week starts Sunday or Monday
typeIn(nextSunday, 'Pizza night');
click($('[data-action="open-settings"]'));
const mondayToggle = $('[data-setting="weekStartsMonday"]');
mondayToggle.checked = true;
mondayToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
click($('[data-action="close-sheet"]'));
await tick();
check(text($('.plan-date')).startsWith('Mon') && text($$('.plan-date')[6]).startsWith('Sun'), 'Settings toggle makes the plan start on Monday');
check($(`.plan-input[data-meal="dinner"][data-date="${nextSunday.dataset.date}"]`)?.value === 'Pizza night', 'entries stay on their dates after switching');
const store0 = () => JSON.parse(window.localStorage.getItem('meal-planner:v1'));
click($('[data-tab="recipes"]'));
click($('.recipe-card [data-action="toggle-week"]'));
click($('[data-tab="plan"]'));
const listBefore = JSON.stringify(store0().week);
check(store0().week.recipeIds.length === 1, 'a meal is on the shopping list before clearing the plan');
click($('[data-action="clear-plan"]'));
check($$('.plan-input').every((i) => !i.value) && JSON.stringify(store0().plan) === '{}' && JSON.stringify(store0().lunch) === '{}', 'Clear meal plan empties lunch and dinner for both weeks');
check(JSON.stringify(store0().week) === listBefore, 'clearing the plan leaves the shopping list alone');
check($('#plan-footer').hidden, 'Clear button hides when the plan is empty');
typeIn(dinners()[2], 'Chili');
check(!$('#plan-footer').hidden, 'Clear button appears as soon as the user types something');
typeIn(dinners()[2], '');
check($('#plan-footer').hidden, 'Clear button hides again when that is erased');
typeIn(lunches()[4], 'Leftovers');
check(!$('#plan-footer').hidden, 'a lunch alone also shows the Clear button');

// 13. Older saved data: sample recipes pick up "uses all" flags, the user's own recipes don't change
const store = await import(pathToFileURL(path.join(root, 'js/store.js')).href);
store.importJSON(JSON.stringify({
  version: 1,
  recipes: [
    { id: 'sample-tacos', name: 'Beef Tacos', sample: true, ingredients: [{ amount: '1 lb', name: 'Ground beef' }, { amount: '8', name: 'Tortillas' }] },
    { id: 'mine', name: 'My Tacos', ingredients: [{ amount: '1 lb', name: 'Ground beef' }] },
  ],
}));
const migrated = store.get().recipes;
check(migrated[0].ingredients[0].usesAll === true && !migrated[0].ingredients[1].usesAll, 'old sample recipe gets the flag');
check(!migrated[1].ingredients[0].usesAll, 'a user-made recipe is left alone');
check(store.get().version === 2, 'saved data upgraded to version 2');
check(JSON.stringify(store.get().plan) === '{}', 'older backups without a plan get an empty one');
check(JSON.stringify(store.get().lunch) === '{}', 'older backups without lunches get an empty lunch plan');
store.importJSON(JSON.stringify({ recipes: [], plan: { '2099-01-01': 'Tacos' } }));
check(store.get().plan['2099-01-01'] === 'Tacos' && JSON.stringify(store.get().lunch) === '{}', 'a backup from before lunches keeps its dinners');

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
