import * as store from './store.js';
import {
  buildList, isChecked, suggestRecipes, ingredientKey, cleanName, guessSection, SECTIONS,
  parsePrice, formatPrice, cheapest, estimateTotals, parseIngredientList,
  findStore, addStore, removeStore, renameStore, priceCounts, storesForEstimate, planWeeks,
} from './logic.js';

// ---------- Small helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const shortDate = (iso) => new Date(`${iso}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

const listFor = (s) => buildList({ recipes: s.recipes, week: s.week, ingredients: s.ingredients, staples: s.staples });
const checkCtx = (s) => ({ week: s.week, pantry: s.pantry, pantryEnabled: s.settings.pantryEnabled });
const plannedMeals = (s) => s.week.recipeIds.map((id) => s.recipes.find((r) => r.id === id)).filter(Boolean);

/** "2 (Stir Fry), 1 tub (Tacos, uses all)" */
const usesText = (uses) => uses
  .map((u) => {
    const note = u.usesAll ? `${u.recipe}, uses all` : u.recipe;
    return u.amount ? `${u.amount} (${note})` : note;
  })
  .join(', ');

function ensureName(s, key, name) {
  if (!s.ingredients[key]) s.ingredients[key] = {};
  if (!s.ingredients[key].name) s.ingredients[key].name = name;
}

// ---------- Tabs ----------

const TITLES = { recipes: 'Recipes', plan: 'Meal Plan', week: 'This Week', else: 'What Else?', pantry: 'Pantry' };
let tab = 'recipes';
let query = '';
try { tab = localStorage.getItem('meal-planner:tab') || 'recipes'; } catch { /* private mode */ }

function setTab(next) {
  tab = next;
  try { localStorage.setItem('meal-planner:tab', tab); } catch { /* ignore */ }
  render();
  window.scrollTo(0, 0);
}

const VIEWS = { recipes: recipesView, plan: planView, week: weekView, else: elseView, pantry: pantryView };

function render() {
  const s = store.get();
  if (!VIEWS[tab] || (tab === 'pantry' && !s.settings.pantryEnabled)) tab = 'recipes';
  $('#title').textContent = TITLES[tab];
  for (const b of $$('#tabbar [data-tab]')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  $('#pantry-tab').hidden = !s.settings.pantryEnabled;
  const count = plannedMeals(s).length;
  const badge = $('#week-badge');
  badge.hidden = count === 0;
  badge.textContent = count;
  $('#view').innerHTML = VIEWS[tab](s);
  $('#ing-names').innerHTML = store.knownIngredientNames().map((n) => `<option value="${esc(n)}">`).join('');
}

// ---------- Recipes tab ----------

function recipesView(s) {
  return `
    <input class="field search" id="recipe-search" type="search" placeholder="Search recipes or ingredients"
      value="${esc(query)}" autocomplete="off" enterkeyhint="search">
    <button class="btn primary block" data-action="new-recipe">+ New recipe</button>
    <div class="section-title"><span>${plural(s.recipes.length, 'recipe')}</span></div>
    <div id="recipe-results" class="recipe-list">${recipeCards(s)}</div>`;
}

function recipeCards(s) {
  if (!s.recipes.length) {
    return `<div class="empty"><strong>No recipes yet</strong>Tap “New recipe” to add your first one.</div>`;
  }
  const q = query.trim().toLowerCase();
  const found = s.recipes
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!found.length) return `<p class="empty">No recipes match “${esc(query)}”.</p>`;
  return found.map((r) => {
    const added = s.week.recipeIds.includes(r.id);
    return `
      <div class="card recipe-card">
        <button class="info" data-action="view-recipe" data-id="${esc(r.id)}">
          <span class="name">${esc(r.name)}</span>
          <span class="meta">${esc(r.ingredients.map((i) => cleanName(i.name)).join(', '))}</span>
        </button>
        <button class="btn small ${added ? 'added' : 'primary'}" data-action="toggle-week" data-id="${esc(r.id)}"
          aria-pressed="${added}" aria-label="${added ? 'Remove from' : 'Add to'} this week: ${esc(r.name)}">
          ${added ? '✓ Added' : '+ Add'}
        </button>
      </div>`;
  }).join('');
}

function toggleWeek(id) {
  const s = store.get();
  const recipe = s.recipes.find((r) => r.id === id);
  if (!recipe) return;
  const adding = !s.week.recipeIds.includes(id);
  store.update((st) => store.toggleIn(st.week.recipeIds, id));
  toast(adding ? `Added ${recipe.name} to this week` : `Removed ${recipe.name}`);
}

// ---------- Plan tab ----------

function planView(s) {
  const names = [...new Set([...plannedMeals(s), ...s.recipes].map((r) => r.name)), 'Leftovers', 'Eating out'];
  return `
    <datalist id="meal-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    ${planWeeks(new Date(), s.settings.weekStartsMonday).map((week) => `
      <div class="section-title"><span>${week.label}</span>
        <span class="plan-range">${week.days[0].month} ${week.days[0].day} – ${week.days[6].month} ${week.days[6].day}</span></div>
      <div class="card plan-week">
        ${week.days.map((d) => `
          <label class="plan-day${d.today ? ' today' : ''}">
            <span class="plan-date"><b>${d.weekday}</b><span>${d.day}</span></span>
            <input class="plan-input" data-date="${d.iso}" value="${esc(s.plan[d.iso] || '')}"
              list="meal-names" placeholder="${d.today ? 'What’s for dinner?' : ''}" autocomplete="off" enterkeyhint="next"
              aria-label="${d.weekday} ${d.month} ${d.day}">
          </label>`).join('')}
      </div>`).join('')}
    <p class="hint" style="margin:10px 4px 0">Type anything: a recipe, “Soup leftovers”, “Pizza night”. It saves as you type.
      Past weeks clear themselves.</p>
    <div class="week-footer" id="plan-footer" ${Object.keys(s.plan).length ? '' : 'hidden'}>
      <button class="btn block danger" data-action="clear-plan">Clear meal plan</button>
    </div>`;
}

function savePlanDay(input) {
  const s = store.get();
  const text = input.value;
  if (text.trim()) s.plan[input.dataset.date] = text;
  else delete s.plan[input.dataset.date];
  store.persist();
  const footer = $('#plan-footer');
  if (footer) footer.hidden = !Object.keys(s.plan).length;
}

// ---------- This Week tab ----------

function weekView(s) {
  const meals = plannedMeals(s);
  const items = listFor(s);
  const ctx = checkCtx(s);
  const { showPrices, stores, currentStore, hideChecked } = s.settings;

  const mealsHtml = meals.length
    ? `<div class="chips">${meals.map((m) => `
        <span class="chip">${esc(m.name)}
          <button data-action="toggle-week" data-id="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">×</button>
        </span>`).join('')}</div>`
    : `<p class="muted small" style="margin:0 4px">No meals yet. Tap <b>+ Add</b> on a recipe to put it on the list.</p>`;

  const regular = items.filter((i) => !i.staple);
  const staples = items.filter((i) => i.staple);
  const toBuy = items.filter((i) => !isChecked(i, ctx));
  const doneCount = items.length - toBuy.length;

  let pricesHtml = '';
  const shownStores = storesForEstimate(regular, s.prices, stores, currentStore);
  if (showPrices && items.length && !shownStores.length) {
    pricesHtml = `
      <div class="section-title"><span>Estimated cost</span>
        <button class="link" data-action="choose-store">+ Add a store</button></div>
      <p class="hint" style="margin:0 4px">💲 Tap the <b>+ $</b> next to an item to save what it costs and where.
        You’ll see an estimated total for each store here.</p>`;
  } else if (showPrices && items.length) {
    const totals = estimateTotals(toBuy.filter((i) => !i.staple), s.prices, shownStores);
    pricesHtml = `
      <div class="section-title"><span>Estimated cost · still to buy</span></div>
      <div class="store-picker" role="group" aria-label="Which store are you shopping at?">
        ${totals.map((t) => `
          <button data-action="pick-store" data-store="${esc(t.store)}" aria-pressed="${t.store === currentStore}">
            <span class="store">${esc(t.store)}</span>
            <span class="total">${t.priced ? `~${formatPrice(t.total)}` : '—'}</span>
            <span class="note">${t.unpriced ? `${t.unpriced} without a price` : toBuy.length ? 'all items priced' : 'nothing left'}</span>
          </button>`).join('')}
        <button class="add-store" data-action="choose-store" aria-label="Add or pick another store">
          <span class="total">+</span><span class="note">Store</span>
        </button>
      </div>
      <p class="hint" style="margin:6px 4px 0">Tap the store you’re shopping at. Stores show up here once they have a price for something on this list.</p>`;
  }

  let listHtml;
  if (!items.length) {
    listHtml = `<div class="card empty"><strong>Your list is empty</strong>Add meals from Recipes, or add a single item above.</div>`;
  } else {
    const visible = (i) => !hideChecked || !isChecked(i, ctx);
    const groups = [];
    for (const section of SECTIONS) {
      const inSection = regular.filter((i) => i.section === section && visible(i));
      if (inSection.length) groups.push({ name: section, items: inSection });
    }
    const visibleStaples = staples.filter(visible);
    if (visibleStaples.length) groups.push({ name: 'Staples · usually on hand', items: visibleStaples });
    const hidden = items.filter((i) => !visible(i)).length;
    listHtml = groups.map((g) => `
      <div class="card list-group">
        <div class="group-name">${esc(g.name)}</div>
        ${g.items.map((i) => itemRow(i, s, ctx)).join('')}
      </div>`).join('')
      + (hidden ? `<p class="muted small" style="text-align:center">${plural(hidden, 'checked item')} hidden ·
          <button class="link" data-action="toggle-hide-checked">Show</button></p>` : '')
      + (!groups.length ? `<div class="card empty"><strong>All done! 🎉</strong>Everything is checked off.</div>` : '');
  }

  return `
    <div class="section-title"><span>Meals (${meals.length})</span>
      <button class="link" data-action="goto" data-tab-target="recipes">+ Add meals</button></div>
    ${mealsHtml}
    ${pricesHtml}
    <div class="section-title"><span>Shopping list · ${doneCount}/${items.length}</span>
      ${items.length ? `<button class="link" data-action="toggle-hide-checked">${hideChecked ? 'Show checked' : 'Hide checked'}</button>` : ''}</div>
    ${items.length ? `<div class="progress" aria-hidden="true"><div style="width:${(doneCount / items.length) * 100}%"></div></div>` : ''}
    <form class="row-form" id="add-item-form" style="margin-bottom:12px">
      <input class="field" id="add-item" list="ing-names" placeholder="Add an item (e.g. paper towels)" autocomplete="off" enterkeyhint="done">
      <button class="btn" type="submit">Add</button>
    </form>
    ${listHtml}
    ${meals.length || s.week.extras.length ? `
      <div class="week-footer">
        <button class="btn block" data-action="goto" data-tab-target="else">💡 What else can I make with this?</button>
        <button class="btn block danger" data-action="new-week">Start a new week</button>
      </div>` : ''}`;
}

function itemRow(item, s, ctx) {
  const done = isChecked(item, ctx);
  const uses = item.extra && !item.uses.length
    ? 'Added by you'
    : usesText(item.uses);
  let tag = '';
  if (s.settings.showPrices && !item.staple) {
    const prices = s.prices[item.key] || {};
    const here = prices[s.settings.currentStore];
    const best = cheapest(prices, s.settings.stores);
    if (here) tag = `<button class="tag has" data-action="edit-item" data-key="${esc(item.key)}" data-focus="price">${formatPrice(here.price)}</button>`;
    else if (best) tag = `<button class="tag has" data-action="edit-item" data-key="${esc(item.key)}" data-focus="price">${formatPrice(best.price)}<small>${esc(best.store)}</small></button>`;
    else tag = `<button class="tag" data-action="edit-item" data-key="${esc(item.key)}" data-focus="price" aria-label="Add a price for ${esc(item.name)}">+ $</button>`;
  }
  return `
    <div class="item ${done ? 'done' : ''}">
      <button class="check" data-action="toggle-check" data-key="${esc(item.key)}" role="checkbox" aria-checked="${done}"
        aria-label="${esc(item.name)}"><span></span></button>
      <button class="body" data-action="edit-item" data-key="${esc(item.key)}">
        <span class="iname">${esc(item.name)}</span>
        ${uses ? `<span class="uses">${esc(uses)}</span>` : ''}
      </button>
      ${tag}
    </div>`;
}

function toggleCheck(key) {
  store.update((s) => {
    const item = listFor(s).find((i) => i.key === key);
    if (!item) return;
    if (item.staple) store.toggleIn(s.week.stapleNeeds, key);
    else if (s.settings.pantryEnabled) {
      store.toggleIn(s.pantry, key);
      ensureName(s, key, item.name);
    } else store.toggleIn(s.week.checked, key);
  });
}

// ---------- What Else tab ----------

function elseView(s) {
  const pantryOn = s.settings.pantryEnabled;
  const hasStuff = plannedMeals(s).length || s.week.extras.length || (pantryOn && s.pantry.length);
  if (!hasStuff) {
    return `<div class="empty"><strong>Pick some meals first</strong>
      Once this week’s list has ingredients on it, this page shows other recipes that use them up.
      <br><button class="btn primary" data-action="goto" data-tab-target="recipes">Browse recipes</button></div>`;
  }
  const results = suggestRecipes({
    recipes: s.recipes, week: s.week, ingredients: s.ingredients, staples: s.staples,
    pantry: s.pantry, pantryEnabled: pantryOn,
  });
  if (!results.length) {
    return `<div class="empty"><strong>No matches yet</strong>
      None of your other recipes use what’s on this week’s list${pantryOn ? ' or in your pantry' : ''}.
      Add more recipes and check back.</div>`;
  }
  const dl = (label, list, cls = '') => (list.length
    ? `<div class="${cls}"><dt>${label}</dt> <dd>${esc(list.join(', '))}</dd></div>` : '');
  const needText = (r) => r.missing.map((n) => (r.usedUp.includes(n) ? `${n} (used up this week)` : n));
  return `
    <p class="muted small" style="margin:4px 4px 16px">Other recipes that use what’s already on this week’s list${pantryOn ? ' and in your pantry' : ''}, closest matches first. Leftovers may only be part of a package, so check there’s enough. Staples like salt and oil aren’t counted.</p>
    ${results.map((r) => `
      <article class="card suggestion">
        <header>
          <h3>${esc(r.recipe.name)}</h3>
          <span class="score ${r.missing.length ? '' : 'ready'}">${r.missing.length ? `Need ${r.missing.length} more` : 'Ready to make'}</span>
        </header>
        <dl>
          ${dl('Left over from this week:', r.fromList)}
          ${dl('From your pantry:', r.fromPantry)}
          ${dl('Need to buy:', needText(r), 'need')}
        </dl>
        <div style="display:flex; gap:8px">
          <button class="btn small primary" data-action="toggle-week" data-id="${esc(r.recipe.id)}">+ Add to this week</button>
          <button class="btn small" data-action="view-recipe" data-id="${esc(r.recipe.id)}">View recipe</button>
        </div>
      </article>`).join('')}`;
}

// ---------- Pantry tab ----------

function pantryView(s) {
  const items = s.pantry.map((key) => ({
    key,
    name: store.displayName(key),
    section: s.ingredients[key]?.section || guessSection(key),
  }));
  const groups = SECTIONS.map((sec) => ({ name: sec, items: items.filter((i) => i.section === sec) }))
    .filter((g) => g.items.length);
  for (const g of groups) g.items.sort((a, b) => a.name.localeCompare(b.name));
  return `
    <p class="muted small" style="margin:4px 4px 12px">What’s in the kitchen right now. Items you check off on your list land here, and stay checked next week. Tap × when something runs out.</p>
    <form class="row-form" id="add-pantry-form" style="margin-bottom:12px">
      <input class="field" id="add-pantry" list="ing-names" placeholder="Add something you have" autocomplete="off" enterkeyhint="done">
      <button class="btn" type="submit">Add</button>
    </form>
    ${groups.length ? groups.map((g) => `
      <div class="card list-group">
        <div class="group-name">${esc(g.name)}</div>
        ${g.items.map((i) => `
          <div class="pantry-item"><span>${esc(i.name)}</span>
            <button data-action="pantry-remove" data-key="${esc(i.key)}" aria-label="Used up: ${esc(i.name)}">×</button></div>`).join('')}
      </div>`).join('')
      + `<div class="week-footer"><button class="btn block danger" data-action="pantry-clear">Clear the whole pantry</button></div>`
    : `<div class="card empty"><strong>Pantry is empty</strong>Check items off your list, or add them here.</div>`}`;
}

// ---------- Sheets (pop-up panels) ----------

let sheet = null;

function openSheet(opts) {
  const wasOpen = !!sheet;
  sheet = { ...opts };
  drawSheet();
  document.body.style.overflow = 'hidden';
  if (!wasOpen) history.pushState({ sheet: true }, '');
  opts.onMount?.($('#sheet-root .sheet'));
}

function drawSheet(keepScroll = false) {
  const root = $('#sheet-root');
  const oldBody = $('.sheet-body', root);
  const scroll = keepScroll && oldBody ? oldBody.scrollTop : 0;
  const body = typeof sheet.body === 'function' ? sheet.body() : sheet.body;
  const actions = typeof sheet.actions === 'function' ? sheet.actions() : sheet.actions;
  root.innerHTML = `
    <div class="sheet-backdrop" data-action="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <h2 id="sheet-title">${esc(sheet.title)}</h2>
          <button class="icon-btn" data-action="close-sheet" aria-label="Close">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="sheet-body">${body}</div>
        ${actions ? `<div class="sheet-actions">${actions}</div>` : ''}
      </div>
    </div>`;
  if (scroll) $('.sheet-body', root).scrollTop = scroll;
}

function removeSheet() {
  sheet = null;
  $('#sheet-root').innerHTML = '';
  document.body.style.overflow = '';
}

/** Close because the user tapped ×, the backdrop, or Back. Asks first if there are unsaved edits. */
function requestClose() {
  if (sheet?.isDirty?.() && !confirm('Discard your changes?')) return;
  if (sheet) sheet.isDirty = null;
  history.back();
}

/** Close after saving — no questions asked. */
function closeSheet() {
  if (!sheet) return;
  sheet.isDirty = null;
  history.back();
}

window.addEventListener('popstate', () => {
  if (!sheet) return;
  if (sheet.isDirty?.() && !confirm('Discard your changes?')) {
    history.pushState({ sheet: true }, '');
    return;
  }
  removeSheet();
});

// ---------- Recipe view & editor ----------

function viewRecipe(id) {
  const r = store.get().recipes.find((x) => x.id === id);
  if (!r) return;
  openSheet({
    title: r.name,
    live: true,
    body: () => `
      <ul class="ing-view">
        ${r.ingredients.map((i) => `<li><span class="amt">${esc(i.amount || '—')}</span>
          <span>${esc(i.name)}${i.usesAll ? '<span class="pill">uses all</span>' : ''}</span></li>`).join('')}
      </ul>
      ${r.notes ? `<p class="label">Notes</p><p class="notes" style="margin:0">${esc(r.notes)}</p>` : ''}`,
    actions: () => {
      const added = store.get().week.recipeIds.includes(r.id);
      return `
        <button class="btn" data-action="edit-recipe" data-id="${esc(r.id)}">Edit</button>
        <button class="btn ${added ? 'added' : 'primary'}" data-action="toggle-week" data-id="${esc(r.id)}">
          ${added ? '✓ On this week' : '+ Add to this week'}</button>`;
    },
  });
}

function ingRow(ing = { amount: '', name: '' }) {
  return `
    <div class="ing-row">
      <input class="field ing-amt" placeholder="Amount" value="${esc(ing.amount)}" autocomplete="off" aria-label="Amount">
      <input class="field ing-name" placeholder="Ingredient" value="${esc(ing.name)}" list="ing-names" autocomplete="off"
        enterkeyhint="next" aria-label="Ingredient">
      <label class="all-toggle"><input type="checkbox" class="ing-all" ${ing.usesAll ? 'checked' : ''}
        aria-label="Uses it all"><span aria-hidden="true">All</span></label>
      <button type="button" data-action="remove-ing-row" aria-label="Remove ingredient">×</button>
    </div>`;
}

function readEditor(root) {
  return {
    name: $('#r-name', root).value.trim(),
    notes: $('#r-notes', root).value.trim(),
    ingredients: $$('.ing-row', root)
      .map((row) => ({
        amount: $('.ing-amt', row).value.trim(),
        name: $('.ing-name', row).value.trim(),
        ...($('.ing-all', row).checked ? { usesAll: true } : {}),
      }))
      .filter((i) => i.name),
  };
}

function editRecipe(id) {
  const existing = id ? store.get().recipes.find((r) => r.id === id) : null;
  const r = existing || { name: '', notes: '', ingredients: [] };
  const rows = r.ingredients.length ? r.ingredients : [{}, {}, {}, {}];
  let initial = '';
  openSheet({
    title: existing ? 'Edit recipe' : 'New recipe',
    body: `
      <label class="label" for="r-name">Recipe name</label>
      <input class="field" id="r-name" value="${esc(r.name)}" placeholder="e.g. Chicken Stir Fry" autocomplete="off" enterkeyhint="next">
      <span class="label">Ingredients</span>
      <div class="ing-rows" id="ing-rows">${rows.map(ingRow).join('')}</div>
      <div style="display:flex; justify-content:space-between">
        <button type="button" class="link" data-action="add-ing-row">+ Add ingredient</button>
        <button type="button" class="link" data-action="toggle-paste">Paste a list</button>
      </div>
      <div id="paste-box" hidden>
        <textarea class="field" id="paste-text" rows="6" placeholder="One ingredient per line, like:&#10;2 cups rice&#10;1 lb chicken breast&#10;3 cloves garlic"></textarea>
        <button type="button" class="btn small" data-action="apply-paste" style="margin-top:8px">Add these ingredients</button>
      </div>
      <p class="hint">Tick <b>All</b> when the recipe uses the whole thing (a whole tub of sour cream, the full pound of beef), so “What Else?” won’t count it as leftover.</p>
      <p class="hint">Use the same name each time (e.g. always “Yellow onion”) so “What Else?” can match recipes. Suggestions pop up as you type.</p>
      <label class="label" for="r-notes">Notes or steps <span class="muted">(optional)</span></label>
      <textarea class="field" id="r-notes" rows="4">${esc(r.notes || '')}</textarea>
      ${existing ? `<button type="button" class="btn block danger" style="margin-top:24px" data-action="delete-recipe" data-id="${esc(existing.id)}">Delete recipe</button>` : ''}`,
    actions: `
      <button class="btn" data-action="close-sheet">Cancel</button>
      <button class="btn primary" data-action="save-recipe" data-id="${esc(existing?.id || '')}">Save</button>`,
    isDirty: () => JSON.stringify(readEditor($('#sheet-root'))) !== initial,
    onMount: (root) => {
      initial = JSON.stringify(readEditor(root));
      if (!existing) $('#r-name', root).focus();
    },
  });
}

function addIngRow(after) {
  const rows = $('#ing-rows');
  const tmp = document.createElement('div');
  tmp.innerHTML = ingRow().trim();
  const row = tmp.firstElementChild;
  if (after) after.after(row);
  else rows.append(row);
  $('.ing-name', row).focus();
}

function saveRecipe(id) {
  const data = readEditor($('#sheet-root'));
  if (!data.name) { alert('Give the recipe a name.'); $('#r-name').focus(); return; }
  if (!data.ingredients.length) { alert('Add at least one ingredient.'); return; }
  store.update((s) => {
    for (const ing of data.ingredients) store.rememberName(s, ing.name);
    const i = s.recipes.findIndex((r) => r.id === id);
    if (i >= 0) s.recipes[i] = { ...s.recipes[i], ...data };
    else s.recipes.push({ id: store.newId(), ...data });
  });
  closeSheet();
  toast(id ? 'Recipe saved' : `Added ${data.name}`);
}

function deleteRecipe(id) {
  const r = store.get().recipes.find((x) => x.id === id);
  if (!r || !confirm(`Delete “${r.name}”? This can’t be undone.`)) return;
  store.update((s) => {
    s.recipes = s.recipes.filter((x) => x.id !== id);
    s.week.recipeIds = s.week.recipeIds.filter((x) => x !== id);
  });
  closeSheet();
  toast(`Deleted ${r.name}`);
}

// ---------- List item editor (name, section, staple, prices) ----------

let rowSeq = 0;

/** A price line for a store the user already has. */
function priceRow(storeName, saved) {
  const id = `price-${++rowSeq}`;
  return `
    <div class="price-row">
      <label for="${id}"><strong>${esc(storeName)}</strong>
        <span class="when">${saved ? `updated ${shortDate(saved.date)}` : 'no price yet'}</span></label>
      <input class="field price-input" id="${id}" data-store="${esc(storeName)}" inputmode="decimal"
        placeholder="$0.00" value="${saved ? saved.price.toFixed(2) : ''}" autocomplete="off">
    </div>`;
}

/** A blank line to type a new store's name and price. */
function newStoreRow() {
  return `
    <div class="price-row new-store-row">
      <input class="field ns-name" list="store-names" placeholder="Store (e.g. Target)"
        autocomplete="off" autocapitalize="words" aria-label="Store name">
      <input class="field ns-price" inputmode="decimal" placeholder="$0.00" autocomplete="off" aria-label="Price">
    </div>`;
}

function editItem(key, focus) {
  const s = store.get();
  const item = listFor(s).find((i) => i.key === key);
  if (!item) return;
  const { showPrices, stores, currentStore } = s.settings;
  const prices = s.prices[key] || {};
  // Stores with a price for this item (cheapest first), then the store the user is at.
  const rowStores = stores
    .filter((st) => prices[st])
    .sort((a, b) => prices[a].price - prices[b].price);
  if (currentStore && stores.includes(currentStore) && !prices[currentStore]) rowStores.push(currentStore);
  const otherStores = stores.filter((st) => !rowStores.includes(st));
  openSheet({
    title: item.name,
    body: `
      ${item.uses.length ? `<p class="muted" style="margin:0">For: ${esc(usesText(item.uses))}</p>` : ''}
      ${showPrices && !item.staple ? `
        <span class="label">What it usually costs</span>
        ${rowStores.length ? '' : '<p class="small muted" style="margin:0 0 6px">Where did you see it, and for how much?</p>'}
        <div id="price-rows">
          ${rowStores.map((st) => priceRow(st, prices[st])).join('')}
          ${rowStores.length ? '' : newStoreRow()}
        </div>
        <div class="add-price-chips" id="add-price-chips">
          ${otherStores.map((st) => `
            <button type="button" class="chip-btn" data-action="add-price-row" data-store="${esc(st)}">+ ${esc(st)}</button>`).join('')}
          <button type="button" class="chip-btn" data-action="add-new-store-row">+ ${stores.length ? 'New store' : 'Another store'}</button>
        </div>
        <datalist id="store-names">${otherStores.map((st) => `<option value="${esc(st)}">`).join('')}</datalist>
        <p class="hint">The price for one of whatever you usually buy: a bag, a pack, a pound. Clear a price to remove it.</p>` : ''}
      <span class="label">Settings</span>
      <div class="card">
        <label class="toggle-row"><div><strong>Always have this</strong><p>Treat it as a staple, like salt. It won’t count in “What Else?”.</p></div>
          <input type="checkbox" class="switch" id="item-staple" ${item.staple ? 'checked' : ''}></label>
      </div>
      <label class="label" for="item-name">Name</label>
      <input class="field" id="item-name" value="${esc(item.name)}" autocomplete="off">
      <label class="label" for="item-section">Store section</label>
      <select class="field" id="item-section">
        ${SECTIONS.map((sec) => `<option ${sec === item.section ? 'selected' : ''}>${esc(sec)}</option>`).join('')}
      </select>
      ${item.extra ? `<button type="button" class="btn block danger" style="margin-top:24px" data-action="remove-extra" data-key="${esc(key)}">Remove from list</button>` : ''}`,
    actions: `
      <button class="btn" data-action="close-sheet">Cancel</button>
      <button class="btn primary" data-action="save-item" data-key="${esc(key)}">Save</button>`,
    onMount: (root) => {
      if (focus === 'price') {
        const here = $$('.price-input', root).find((i) => i.dataset.store === currentStore);
        (here || $('.ns-name', root))?.focus();
      }
    },
  });
}

function saveItem(key) {
  const root = $('#sheet-root');
  const priceInputs = $$('.price-input', root);
  const newRows = $$('.new-store-row', root).map((row) => ({ name: $('.ns-name', row), price: $('.ns-price', row) }));
  for (const input of [...priceInputs, ...newRows.map((r) => r.price)]) {
    if (input.value.trim() && parsePrice(input.value) === null) {
      alert(`“${input.value}” doesn’t look like a price.`);
      input.focus();
      return;
    }
  }
  const unnamed = newRows.find((r) => r.price.value.trim() && !r.name.value.trim());
  if (unnamed) {
    alert('Which store is that price from?');
    unnamed.name.focus();
    return;
  }
  const name = $('#item-name', root).value.trim();
  const section = $('#item-section', root).value;
  const staple = $('#item-staple', root).checked;
  store.update((s) => {
    const meta = (s.ingredients[key] ||= {});
    if (name) meta.name = name;
    // Only store the section if the user changed it from the automatic guess.
    if (section === guessSection(key)) delete meta.section;
    else meta.section = section;
    const isStaple = s.staples.includes(key);
    if (staple !== isStaple) store.toggleIn(s.staples, key);
    const setPrice = (storeName, price) => {
      s.prices[key] ||= {};
      if (price === null) delete s.prices[key][storeName];
      else if (s.prices[key][storeName]?.price !== price) s.prices[key][storeName] = { price, date: today() };
    };
    for (const input of priceInputs) setPrice(input.dataset.store, parsePrice(input.value));
    // New stores typed in here are saved for every item from now on.
    for (const row of newRows) {
      if (!row.name.value.trim()) continue;
      const storeName = addStore(s.settings, row.name.value);
      const price = parsePrice(row.price.value);
      if (price !== null) setPrice(storeName, price);
    }
    if (s.prices[key] && !Object.keys(s.prices[key]).length) delete s.prices[key];
  });
  closeSheet();
}

// ---------- Picking or adding a store ----------

function chooseStore() {
  openSheet({
    title: 'Where are you shopping?',
    live: true,
    body: () => {
      const { stores, currentStore } = store.get().settings;
      return `
        ${stores.length ? `
          <div class="store-choices">
            ${stores.map((st) => `
              <button class="btn ${st === currentStore ? 'added' : ''}" data-action="set-store" data-store="${esc(st)}">
                ${st === currentStore ? '✓ ' : ''}${esc(st)}</button>`).join('')}
          </div>` : ''}
        <label class="label" for="new-store-name">${stores.length ? 'Or add a new store' : 'Add a store'}</label>
        <form class="row-form" id="choose-store-form">
          <input class="field" id="new-store-name" placeholder="e.g. Target" autocomplete="off"
            autocapitalize="words" enterkeyhint="done">
          <button class="btn primary" type="submit">Add</button>
        </form>
        <p class="hint">Then tap <b>+ $</b> next to any item to save its price there. Rename or remove stores in Settings.</p>`;
    },
    onMount: (root) => { if (!store.get().settings.stores.length) $('#new-store-name', root).focus(); },
  });
}

// ---------- Settings ----------

function openSettings() {
  openSheet({
    title: 'Settings',
    live: true,
    body: () => {
      const s = store.get();
      const { pantryEnabled, showPrices, stores } = s.settings;
      const samples = s.recipes.filter((r) => r.sample).length;
      const counts = priceCounts(s.prices);
      const chipList = (keys, action) => keys.map((k) => `
        <span class="chip">${esc(k.name)}<button data-action="${action}" data-value="${esc(k.value)}" aria-label="Remove ${esc(k.name)}">×</button></span>`).join('');
      return `
        <div class="card">
          <label class="toggle-row"><div><strong>Remember my pantry</strong>
            <p>Things you check off stay checked from week to week, and “What Else?” uses them too. Adds a Pantry tab.</p></div>
            <input type="checkbox" class="switch" data-setting="pantryEnabled" ${pantryEnabled ? 'checked' : ''}></label>
          <label class="toggle-row"><div><strong>Track prices</strong>
            <p>Save what things cost at each store and see an estimated total for the trip.</p></div>
            <input type="checkbox" class="switch" data-setting="showPrices" ${showPrices ? 'checked' : ''}></label>
          <label class="toggle-row"><div><strong>Start week on Monday</strong>
            <p>The meal plan runs Monday to Sunday instead of Sunday to Saturday.</p></div>
            <input type="checkbox" class="switch" data-setting="weekStartsMonday" ${s.settings.weekStartsMonday ? 'checked' : ''}></label>
        </div>

        ${showPrices ? `
          <span class="label">Stores</span>
          ${stores.length ? `
            <div class="card list-group" style="margin-bottom:10px">
              ${stores.map((st) => `
                <div class="store-row">
                  <span><strong>${esc(st)}</strong><small>${plural(counts[st] || 0, 'price')}</small></span>
                  <button class="link" data-action="rename-store" data-value="${esc(st)}">Rename</button>
                  <button class="icon-btn" data-action="remove-store" data-value="${esc(st)}" aria-label="Remove ${esc(st)}">×</button>
                </div>`).join('')}
            </div>`
          : '<p class="hint" style="margin:0 0 10px">No stores yet. Add one here, or right from an item’s price screen when you note a price.</p>'}
          <form class="row-form" id="add-store-form">
            <input class="field" id="add-store" placeholder="Add a store" autocomplete="off" enterkeyhint="done">
            <button class="btn" type="submit">Add</button>
          </form>` : ''}

        <span class="label">Staples (always on hand)</span>
        <p class="hint" style="margin:0 0 10px">These start checked on the list and don’t count when matching recipes.</p>
        <div class="edit-chips">${chipList(
          s.staples.map((k) => ({ name: store.displayName(k), value: k })).sort((a, b) => a.name.localeCompare(b.name)),
          'remove-staple',
        )}</div>
        <form class="row-form" id="add-staple-form">
          <input class="field" id="add-staple" list="ing-names" placeholder="Add a staple" autocomplete="off" enterkeyhint="done">
          <button class="btn" type="submit">Add</button>
        </form>

        <span class="label">Backup</span>
        <p class="hint" style="margin:0 0 10px">Everything is saved on this phone only. Save a backup now and then, so nothing is lost if the phone is replaced.</p>
        <div style="display:grid; gap:8px">
          <button class="btn block" data-action="backup">Save a backup file</button>
          <label class="btn block">Restore from a backup<input type="file" id="restore-file" accept="application/json,.json" hidden></label>
        </div>

        ${samples ? `
          <span class="label">Sample recipes</span>
          <button class="btn block" data-action="remove-samples">Remove the ${plural(samples, 'sample recipe')}</button>` : ''}

        <span class="label">Start over</span>
        <button class="btn block danger" data-action="reset-all">Erase everything</button>
        <p class="hint" style="text-align:center; margin-top:24px">Grub Bud · made with love</p>`;
    },
  });
}

function setSetting(name, value) {
  store.update((s) => {
    s.settings[name] = value;
    if (name === 'pantryEnabled') {
      const listKeys = new Set(listFor(s).map((i) => i.key));
      if (value) {
        // Carry this week's checks into the pantry.
        for (const key of s.week.checked) {
          if (!s.pantry.includes(key)) s.pantry.push(key);
          const item = listFor(s).find((i) => i.key === key);
          if (item) ensureName(s, key, item.name);
        }
      } else {
        // Keep the list looking the same after switching off.
        for (const key of s.pantry) if (listKeys.has(key) && !s.week.checked.includes(key)) s.week.checked.push(key);
      }
    }
  });
  if (name === 'pantryEnabled') toast(value ? 'Pantry is on. Check items off to fill it.' : 'Pantry is off');
}

async function backup() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const filename = `grub-bud-backup-${today()}.json`;
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Grub Bud backup' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function restore(file) {
  try {
    const text = await file.text();
    if (!confirm('Replace everything in the app with this backup?')) return;
    store.importJSON(text);
    toast('Backup restored');
  } catch (err) {
    alert(`Couldn’t restore that file. ${err.message}`);
  }
}

// ---------- Event wiring ----------

const actions = {
  'open-settings': () => openSettings(),
  goto: (el) => setTab(el.dataset.tabTarget),
  'new-recipe': () => editRecipe(null),
  'view-recipe': (el) => viewRecipe(el.dataset.id),
  'edit-recipe': (el) => editRecipe(el.dataset.id),
  'save-recipe': (el) => saveRecipe(el.dataset.id),
  'delete-recipe': (el) => deleteRecipe(el.dataset.id),
  'toggle-week': (el) => toggleWeek(el.dataset.id),
  'add-ing-row': () => addIngRow(),
  'remove-ing-row': (el) => {
    const row = el.closest('.ing-row');
    if ($$('.ing-row').length > 1) row.remove();
    else {
      $$('input', row).forEach((i) => { i.value = ''; });
      $('.ing-all', row).checked = false;
    }
  },
  'toggle-paste': () => {
    const box = $('#paste-box');
    box.hidden = !box.hidden;
    if (!box.hidden) $('#paste-text').focus();
  },
  'apply-paste': () => {
    const parsed = parseIngredientList($('#paste-text').value);
    if (!parsed.length) return;
    for (const row of $$('.ing-row')) if (!$('.ing-name', row).value.trim() && !$('.ing-amt', row).value.trim()) row.remove();
    $('#ing-rows').insertAdjacentHTML('beforeend', parsed.map(ingRow).join(''));
    $('#paste-text').value = '';
    $('#paste-box').hidden = true;
    toast(`Added ${plural(parsed.length, 'ingredient')}. Check the names look right.`);
  },
  'toggle-check': (el) => toggleCheck(el.dataset.key),
  'edit-item': (el) => editItem(el.dataset.key, el.dataset.focus),
  'save-item': (el) => saveItem(el.dataset.key),
  'remove-extra': (el) => {
    store.update((s) => { s.week.extras = s.week.extras.filter((x) => x.key !== el.dataset.key); });
    closeSheet();
  },
  'pick-store': (el) => store.update((s) => { s.settings.currentStore = el.dataset.store; }),
  'choose-store': () => chooseStore(),
  'add-price-row': (el) => {
    $('#price-rows').insertAdjacentHTML('beforeend', priceRow(el.dataset.store, null));
    el.remove();
    $('#price-rows .price-row:last-child .price-input').focus();
  },
  'add-new-store-row': () => {
    $('#price-rows').insertAdjacentHTML('beforeend', newStoreRow());
    $('#price-rows .price-row:last-child .ns-name').focus();
  },
  'set-store': (el) => {
    store.update((s) => { s.settings.currentStore = el.dataset.store; });
    closeSheet();
    toast(`Shopping at ${el.dataset.store}`);
  },
  'toggle-hide-checked': () => store.update((s) => { s.settings.hideChecked = !s.settings.hideChecked; }),
  'new-week': () => {
    const pantryOn = store.get().settings.pantryEnabled;
    if (!confirm(`Clear this week’s meals and shopping list?${pantryOn ? ' Your pantry stays as it is.' : ''}`)) return;
    store.update((s) => { s.week = store.emptyWeek(); });
    toast('Fresh week. Pick some meals!');
  },
  'clear-plan': () => {
    if (!confirm('Clear both weeks of the meal plan? Your shopping list stays as it is.')) return;
    store.update((s) => { s.plan = {}; });
    toast('Meal plan cleared');
  },
  'pantry-remove': (el) => store.update((s) => { s.pantry = s.pantry.filter((k) => k !== el.dataset.key); }),
  'pantry-clear': () => {
    if (confirm('Remove everything from the pantry?')) store.update((s) => { s.pantry = []; });
  },
  'remove-store': (el) => {
    const name = el.dataset.value;
    const n = priceCounts(store.get().prices)[name] || 0;
    const msg = n ? `Remove ${name}? Its ${plural(n, 'saved price')} will be deleted too.` : `Remove ${name}?`;
    if (!confirm(msg)) return;
    store.update((s) => removeStore(s, name));
  },
  'rename-store': (el) => {
    const from = el.dataset.value;
    const to = prompt(`New name for ${from}:`, from);
    if (to === null || to.trim() === from) return;
    const others = store.get().settings.stores.filter((x) => x !== from);
    const target = findStore(others, to);
    if (target && !confirm(`You already have ${target}. Combine ${from} into ${target}?`)) return;
    store.update((s) => renameStore(s, from, to));
  },
  'remove-staple': (el) => store.update((s) => { s.staples = s.staples.filter((k) => k !== el.dataset.value); }),
  backup: () => backup(),
  'remove-samples': () => {
    if (!confirm('Remove the sample recipes? Your own recipes stay.')) return;
    store.update((s) => {
      const ids = new Set(s.recipes.filter((r) => r.sample).map((r) => r.id));
      s.recipes = s.recipes.filter((r) => !ids.has(r.id));
      s.week.recipeIds = s.week.recipeIds.filter((id) => !ids.has(id));
    });
  },
  'reset-all': () => {
    if (!confirm('Erase ALL recipes, lists, prices and settings on this phone?')) return;
    if (!confirm('Are you sure? This can’t be undone unless you have a backup.')) return;
    store.resetAll();
    closeSheet();
    toast('Everything erased');
  },
  'close-sheet': () => requestClose(),
  'sheet-backdrop': (el, e) => { if (e.target === el) requestClose(); },
};

const forms = {
  'choose-store-form': (form) => {
    const input = $('#new-store-name', form);
    if (!input.value.trim()) return;
    let name;
    store.update((s) => {
      name = addStore(s.settings, input.value);
      s.settings.currentStore = name; // the user is adding it because they're shopping there
    });
    closeSheet();
    toast(`Added ${name}. Tap + $ on an item to save a price.`);
  },
  'add-item-form': (form) => {
    const input = $('#add-item', form);
    const name = cleanName(input.value);
    const key = ingredientKey(name);
    if (!key) return;
    const s = store.get();
    if (listFor(s).some((i) => i.key === key)) {
      toast(`${name} is already on the list`);
      input.value = '';
      return;
    }
    store.update((st) => {
      st.week.extras.push({ key, name });
      store.rememberName(st, name);
    });
  },
  'add-pantry-form': (form) => {
    const name = cleanName($('#add-pantry', form).value);
    const key = ingredientKey(name);
    if (!key) return;
    store.update((s) => {
      if (!s.pantry.includes(key)) s.pantry.push(key);
      store.rememberName(s, name);
    });
  },
  'add-store-form': (form) => {
    const name = $('#add-store', form).value.trim();
    if (!name) return;
    store.update((s) => { addStore(s.settings, name); });
  },
  'add-staple-form': (form) => {
    const name = cleanName($('#add-staple', form).value);
    const key = ingredientKey(name);
    if (!key) return;
    store.update((s) => {
      if (!s.staples.includes(key)) s.staples.push(key);
      store.rememberName(s, name);
    });
  },
};

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('#tabbar [data-tab]');
  if (tabBtn) { setTab(tabBtn.dataset.tab); return; }
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});

document.addEventListener('submit', (e) => {
  const handler = forms[e.target.id];
  if (!handler) return;
  e.preventDefault();
  handler(e.target);
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-setting]')) setSetting(e.target.dataset.setting, e.target.checked);
  if (e.target.id === 'restore-file' && e.target.files[0]) restore(e.target.files[0]);
});

document.addEventListener('input', (e) => {
  if (e.target.classList.contains('plan-input')) {
    savePlanDay(e.target);
    return;
  }
  if (e.target.id === 'recipe-search') {
    query = e.target.value;
    $('#recipe-results').innerHTML = recipeCards(store.get());
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList?.contains('plan-input')) {
    e.preventDefault();
    const inputs = $$('.plan-input');
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
    return;
  }
  if (e.key === 'Enter' && e.target.classList?.contains('ing-name')) {
    e.preventDefault();
    addIngRow(e.target.closest('.ing-row'));
  }
});

// Redraw on every change; a live sheet (settings, recipe view) redraws too.
store.subscribe(() => {
  const active = document.activeElement?.id;
  render();
  if (sheet?.live) drawSheet(true);
  // Keep the keyboard up after adding an item, so the user can add several in a row.
  if (['add-item', 'add-pantry', 'add-store', 'add-staple'].includes(active)) $(`#${active}`)?.focus();
});

store.load();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline mode unavailable', err));
}
