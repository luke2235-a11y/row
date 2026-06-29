// =============================================================
// Meal Planner app logic. Deterministic scoring engine (no AI) —
// see MEALS_RECIPES / MEALS_PRICES / MEALS_AISLES in meals-data.js.
// =============================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RECIPES = window.MEALS_RECIPES;
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const K = {
    profile:'meals:profile', family:'meals:family', pantry:'meals:pantry',
    favorites:'meals:favorites', plan:'meals:plan', history:'meals:history'
  };
  function loadJSON(key, fb) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } }
  function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  let profile = loadJSON(K.profile, null);
  let family = loadJSON(K.family, []);
  let pantry = loadJSON(K.pantry, []);
  let favorites = loadJSON(K.favorites, []);
  let plan = loadJSON(K.plan, null);
  let history = loadJSON(K.history, []);
  let preferFavorites = false;

  function recipeById(id) { return RECIPES.find((r) => r.id === id); }
  function weekStartKey(d) {
    const dt = new Date(d); const day = dt.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Monday as start
    dt.setDate(dt.getDate() + diff);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  // ---------------------------------------------------------------
  // Seed from existing nutrition.html profile, if present
  // ---------------------------------------------------------------
  function seedFromNutrition() {
    try {
      const np = JSON.parse(localStorage.getItem('nutrition:profile'));
      if (!np) return { diet:[], avoid:[] };
      const diet = [];
      if (np.diet === 'vegan') diet.push('vegan');
      if (np.diet === 'vegetarian') diet.push('vegetarian');
      const avoid = (np.allergies || '').split(',').map((s) => s.trim()).filter(Boolean);
      return { diet, avoid };
    } catch (e) { return { diet:[], avoid:[] }; }
  }

  // ---------------------------------------------------------------
  // Profile (onboarding)
  // ---------------------------------------------------------------
  function chipToggle(rowId) {
    document.querySelectorAll('#' + rowId + ' .chip').forEach((c) => {
      c.addEventListener('click', () => c.classList.toggle('active'));
    });
  }
  function chipActiveValues(rowId) {
    return Array.from(document.querySelectorAll('#' + rowId + ' .chip.active')).map((c) => c.dataset.v);
  }
  function setChipActive(rowId, values) {
    document.querySelectorAll('#' + rowId + ' .chip').forEach((c) => {
      c.classList.toggle('active', values.indexOf(c.dataset.v) !== -1);
    });
  }
  chipToggle('dietChips'); chipToggle('styleChips'); chipToggle('applianceChips');

  function fillProfileForm() {
    if (profile) {
      $('mPeople').value = profile.people;
      $('mBudget').value = profile.budget;
      $('mSupermarket').value = profile.supermarket;
      $('mCookTime').value = profile.cookTime;
      setChipActive('dietChips', profile.diet || []);
      setChipActive('styleChips', profile.mealStyles || []);
      setChipActive('applianceChips', profile.appliances || []);
      $('mAvoid').value = (profile.avoid || []).join(', ');
    } else {
      const seed = seedFromNutrition();
      setChipActive('dietChips', seed.diet);
      $('mAvoid').value = seed.avoid.join(', ');
    }
  }
  function renderProfileSummary() {
    const has = !!profile;
    $('profileFormCard').style.display = has ? 'none' : '';
    $('profileSummaryCard').style.display = has ? '' : 'none';
    if (!has) return;
    const sm = window.MEALS_SUPERMARKETS[profile.supermarket];
    $('profileSummaryLine').innerHTML =
      '<b>' + profile.people + '</b> eating · Budget <b>£' + profile.budget + '</b>/week · ' +
      'Shopping at <b>' + (sm ? sm.label : profile.supermarket) + '</b> · Max <b>' + (profile.cookTime >= 999 ? '60+' : profile.cookTime) + ' min</b> cook time' +
      (profile.diet.length ? ' · ' + profile.diet.join(', ') : '') +
      (profile.avoid.length ? ' · avoiding ' + profile.avoid.join(', ') : '');
  }
  $('saveProfileBtn').addEventListener('click', () => {
    const budget = parseFloat($('mBudget').value);
    if (!budget) { alert('Enter a weekly budget.'); return; }
    profile = {
      people: parseInt($('mPeople').value, 10),
      budget,
      supermarket: $('mSupermarket').value,
      cookTime: parseInt($('mCookTime').value, 10),
      diet: chipActiveValues('dietChips'),
      mealStyles: chipActiveValues('styleChips'),
      appliances: chipActiveValues('applianceChips'),
      avoid: $('mAvoid').value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    };
    saveJSON(K.profile, profile);
    renderProfileSummary();
  });
  $('editProfileBtn').addEventListener('click', () => { fillProfileForm(); $('profileFormCard').style.display = ''; $('profileSummaryCard').style.display = 'none'; });

  // ---------------------------------------------------------------
  // Family members
  // ---------------------------------------------------------------
  function renderFamily() {
    const list = $('familyList');
    list.innerHTML = '';
    if (!family.length) {
      const li = document.createElement('li'); li.className = 'empty-state'; li.textContent = 'No family members added yet.';
      list.appendChild(li); return;
    }
    family.forEach((m) => {
      const li = document.createElement('li'); li.className = 'gm-row';
      const txt = document.createElement('div'); txt.className = 'gm-text';
      txt.innerHTML = m.name + (m.diet ? ' · ' + m.diet : '') + '<small>' + (m.dislikes.length ? 'Avoids: ' + m.dislikes.join(', ') : 'No restrictions') + '</small>';
      const del = document.createElement('button'); del.className = 'goal-delete'; del.type = 'button'; del.textContent = '×';
      del.addEventListener('click', () => { family = family.filter((x) => x.id !== m.id); saveJSON(K.family, family); renderFamily(); });
      li.append(txt, del); list.appendChild(li);
    });
  }
  $('famAddBtn').addEventListener('click', () => {
    const name = $('famName').value.trim();
    if (!name) return;
    family.push({
      id:'fam' + Date.now(), name,
      diet: $('famDiet').value.trim().toLowerCase(),
      dislikes: $('famDislikes').value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    });
    saveJSON(K.family, family);
    $('famName').value = ''; $('famDiet').value = ''; $('famDislikes').value = '';
    renderFamily();
  });
  function familyDietRequirements() {
    const req = new Set();
    family.forEach((m) => { if (m.diet && ['vegan','vegetarian','pescatarian','glutenfree','dairyfree','nutfree','halal','kosher'].includes(m.diet.replace(/\s/g,''))) req.add(m.diet.replace(/\s/g,'').replace('gluten free','glutenFree')); });
    return Array.from(req);
  }
  function familyAvoidList() {
    let out = [];
    family.forEach((m) => { out = out.concat(m.dislikes); });
    return out;
  }

  // ---------------------------------------------------------------
  // Pantry
  // ---------------------------------------------------------------
  function renderPantry() {
    const list = $('pantryList');
    list.innerHTML = '';
    if (!pantry.length) {
      const li = document.createElement('li'); li.className = 'empty-state'; li.textContent = 'Pantry is empty.';
      list.appendChild(li); return;
    }
    pantry.forEach((p) => {
      const li = document.createElement('li'); li.className = 'gm-row';
      const txt = document.createElement('div'); txt.className = 'gm-text';
      txt.textContent = p.name + ' — ' + p.qty + p.unit;
      const del = document.createElement('button'); del.className = 'goal-delete'; del.type = 'button'; del.textContent = '×';
      del.addEventListener('click', () => { pantry = pantry.filter((x) => x.id !== p.id); saveJSON(K.pantry, pantry); renderPantry(); });
      li.append(txt, del); list.appendChild(li);
    });
  }
  $('panAddBtn').addEventListener('click', () => {
    const name = $('panName').value.trim();
    const qty = parseFloat($('panQty').value);
    if (!name || !qty) return;
    pantry.push({ id:'pan' + Date.now(), name: name.toLowerCase(), qty, unit: $('panUnit').value });
    saveJSON(K.pantry, pantry);
    $('panName').value = ''; $('panQty').value = '';
    renderPantry();
  });

  // ---------------------------------------------------------------
  // Scoring engine
  // ---------------------------------------------------------------
  function recentlyEatenIds() {
    const ids = [];
    history.slice(-2).forEach((h) => h.days.forEach((d) => ids.push(d.recipeId)));
    if (plan) plan.days.forEach((d) => ids.push(d.recipeId));
    return ids;
  }
  function passesHardFilters(recipe, ctx) {
    if (!recipe.appliances.some((a) => ctx.appliances.indexOf(a) !== -1)) return false;
    if (recipe.cookTime > ctx.cookTime) return false;
    for (const flag of ctx.dietReq) { if (!recipe.diet[flag]) return false; }
    return true;
  }
  function scoreRecipe(recipe, ctx, prevIngredients, usedThisWeek) {
    if (usedThisWeek.has(recipe.id)) return -Infinity;
    if (!passesHardFilters(recipe, ctx)) return -Infinity;
    let s = 0;
    const names = recipe.ingredients.map((i) => i[0].toLowerCase());
    // avoid-list: heavy penalty rather than hard exclude (matches the doc's own -1000 example)
    if (names.some((n) => ctx.avoid.some((a) => n.indexOf(a) !== -1))) s -= 1000;
    // meal style tag matches
    recipe.tags.forEach((t) => { if (ctx.mealStyles.indexOf(t) !== -1) s += 12; });
    // budget: per-meal share of weekly budget
    const mealCost = recipe.cost * ctx.people;
    if (mealCost <= ctx.dailyBudgetShare) s += 15; else s -= 80;
    // appliance preference bonus (air fryer / slow cooker novelty)
    if (recipe.appliances.indexOf('air_fryer') !== -1 || recipe.appliances.indexOf('slow_cooker') !== -1) s += 10;
    if (recipe.cookTime <= 20) s += 8;
    if (ctx.recentIds.indexOf(recipe.id) !== -1) s -= 20;
    if (favorites.indexOf(recipe.id) !== -1 && preferFavorites) s += 25;
    // leftover reuse bonus
    if (prevIngredients) {
      const overlap = names.filter((n) => prevIngredients.indexOf(n) !== -1).length;
      s += Math.min(30, overlap * 15);
    }
    // pantry bonus
    const pantryNames = pantry.map((p) => p.name);
    const pantryHits = names.filter((n) => pantryNames.some((p) => n.indexOf(p) !== -1)).length;
    s += pantryHits * 5;
    return s;
  }

  function buildContext() {
    const dietReq = Array.from(new Set((profile.diet || []).concat(familyDietRequirements())));
    const avoid = Array.from(new Set((profile.avoid || []).concat(familyAvoidList())));
    return {
      appliances: profile.appliances.length ? profile.appliances : ['hob','oven','air_fryer','microwave','slow_cooker','pressure_cooker','bbq'],
      cookTime: profile.cookTime, dietReq, avoid,
      mealStyles: profile.mealStyles || [], people: profile.people,
      dailyBudgetShare: (profile.budget / 7), recentIds: recentlyEatenIds()
    };
  }

  function buildWeek() {
    if (!profile) { alert('Save your household profile first.'); return; }
    const ctx = buildContext();
    const usedThisWeek = new Set();
    let prevIngredients = null;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const scored = RECIPES.map((r) => ({ r, s: scoreRecipe(r, ctx, prevIngredients, usedThisWeek) }))
        .filter((x) => x.s > -Infinity)
        .sort((a, b) => b.s - a.s);
      if (!scored.length) { days.push({ day: DAYS[i], recipeId: null }); continue; }
      const top = scored.slice(0, 3);
      const pick = top[Math.floor(Math.random() * top.length)].r;
      usedThisWeek.add(pick.id);
      prevIngredients = pick.ingredients.map((ing) => ing[0].toLowerCase());
      days.push({ day: DAYS[i], recipeId: pick.id });
    }
    if (plan) history = [...history, plan].slice(-8);
    plan = { weekStart: weekStartKey(new Date()), days, generatedAt: new Date().toISOString() };
    saveJSON(K.plan, plan); saveJSON(K.history, history);
    renderAll();
  }
  function swapDay(idx) {
    if (!profile || !plan) return;
    const ctx = buildContext();
    const usedThisWeek = new Set(plan.days.map((d) => d.recipeId).filter((id, i) => i !== idx));
    const prev = idx > 0 ? recipeById(plan.days[idx - 1].recipeId) : null;
    const prevIngredients = prev ? prev.ingredients.map((i) => i[0].toLowerCase()) : null;
    const scored = RECIPES.map((r) => ({ r, s: scoreRecipe(r, ctx, prevIngredients, usedThisWeek) }))
      .filter((x) => x.s > -Infinity).sort((a, b) => b.s - a.s);
    if (!scored.length) { alert('No alternative recipe fits your filters.'); return; }
    const top = scored.slice(0, 3);
    const pick = top[Math.floor(Math.random() * top.length)].r;
    plan.days[idx].recipeId = pick.id;
    saveJSON(K.plan, plan);
    renderAll();
  }

  $('generateBtn').addEventListener('click', buildWeek);
  $('preferFavBtn').addEventListener('click', () => {
    preferFavorites = !preferFavorites;
    $('preferFavBtn').classList.toggle('chip', false);
    $('preferFavBtn').style.background = preferFavorites ? 'rgba(107,227,164,0.18)' : '';
    $('preferFavBtn').textContent = preferFavorites ? 'Preferring Favorites ✓' : 'Prefer Favorites';
  });

  // ---------------------------------------------------------------
  // Week grid + recipe modal
  // ---------------------------------------------------------------
  function renderWeek() {
    const grid = $('weekGrid');
    grid.innerHTML = '';
    $('weekOfLabel').textContent = plan ? plan.weekStart : '—';
    if (!plan) { grid.innerHTML = '<div class="empty-state">No plan yet — generate your week above.</div>'; return; }
    plan.days.forEach((d, idx) => {
      const r = recipeById(d.recipeId);
      const card = document.createElement('div'); card.className = 'day-card';
      if (!r) {
        card.innerHTML = '<div class="dc-day">' + d.day + '</div><div class="empty-state">No fit found</div>';
        grid.appendChild(card); return;
      }
      card.innerHTML =
        '<div class="dc-day">' + d.day + '</div>' +
        '<div class="dc-emoji">' + r.emoji + '</div>' +
        '<div class="dc-title">' + r.title + '</div>' +
        '<div class="dc-meta"><span>' + r.cookTime + ' min</span><span>' + r.cal + ' kcal</span></div>';
      card.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') openRecipeModal(r.id); });
      const swapBtn = document.createElement('button');
      swapBtn.className = 'gm-ghost dc-swap'; swapBtn.type = 'button'; swapBtn.textContent = 'Swap';
      swapBtn.addEventListener('click', (e) => { e.stopPropagation(); swapDay(idx); });
      card.appendChild(swapBtn);
      grid.appendChild(card);
    });
    renderPlanHealth();
  }
  function renderPlanHealth() {
    const badge = $('planHealthBadge'); const lines = $('planHealthLines');
    if (!plan) { badge.textContent = 'No plan yet'; lines.innerHTML = ''; return; }
    const recipes = plan.days.map((d) => recipeById(d.recipeId)).filter(Boolean);
    const totalCost = recipes.reduce((s, r) => s + r.cost * profile.people, 0);
    const avgProtein = recipes.reduce((s, r) => s + r.protein, 0) / (recipes.length || 1);
    const unique = new Set(recipes.map((r) => r.id)).size;
    const overBudget = totalCost > profile.budget;
    badge.textContent = overBudget ? '⚠ Over budget' : '✓ On budget';
    const checks = [
      (overBudget ? '⚠' : '✓') + ' Est. cost £' + totalCost.toFixed(2) + ' vs £' + profile.budget + ' budget',
      '✓ Variety: ' + unique + '/7 unique meals',
      (avgProtein < 30 ? '⚠' : '✓') + ' Avg protein ' + Math.round(avgProtein) + 'g/meal'
    ];
    lines.innerHTML = checks.map((c) => '<div class="nut-summary-line">' + c + '</div>').join('');
  }

  function openRecipeModal(id) {
    const r = recipeById(id);
    if (!r) return;
    const isFav = favorites.indexOf(id) !== -1;
    $('recipeModal').innerHTML =
      '<div class="recipe-modal-emoji">' + r.emoji + '</div>' +
      '<h2 style="text-align:center;">' + r.title + '</h2>' +
      '<div class="recipe-modal-tags">' + r.tags.map((t) => '<span>' + t.replace('_',' ') + '</span>').join('') + '<span>' + r.cookTime + ' min</span><span>£' + r.cost.toFixed(2) + '/serving</span></div>' +
      '<div class="stat-grid" style="margin-bottom:16px;">' +
        '<div class="stat"><div class="stat-num">' + r.cal + '</div><div class="stat-label">kcal</div></div>' +
        '<div class="stat"><div class="stat-num">' + r.protein + 'g</div><div class="stat-label">Protein</div></div>' +
        '<div class="stat"><div class="stat-num">' + r.carbs + 'g</div><div class="stat-label">Carbs</div></div>' +
        '<div class="stat"><div class="stat-num">' + r.fat + 'g</div><div class="stat-label">Fat</div></div>' +
      '</div>' +
      '<h4 style="color:var(--text-tertiary); font-size:11px; letter-spacing:0.1em; text-transform:uppercase;">Ingredients (per serving)</h4>' +
      '<ul class="recipe-ing-list">' + r.ingredients.map((i) => '<li>' + i[1] + i[2] + ' ' + i[0] + '</li>').join('') + '</ul>' +
      '<h4 style="color:var(--text-tertiary); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; margin-top:14px;">Instructions</h4>' +
      '<ol class="recipe-step-list">' + r.steps.map((s) => '<li>' + s + '</li>').join('') + '</ol>' +
      '<div class="gm-input-wrap">' +
        '<button class="gm-add" id="modalFavBtn" type="button">' + (isFav ? '★ Favorited' : '☆ Add to Favorites') + '</button>' +
        '<button class="gm-ghost" id="modalCloseBtn" type="button">Close</button>' +
      '</div>';
    $('modalFavBtn').addEventListener('click', () => { toggleFavorite(id); openRecipeModal(id); });
    $('modalCloseBtn').addEventListener('click', closeRecipeModal);
    $('recipeModalBg').classList.add('show');
  }
  function closeRecipeModal() { $('recipeModalBg').classList.remove('show'); }
  $('recipeModalBg').addEventListener('click', (e) => { if (e.target.id === 'recipeModalBg') closeRecipeModal(); });

  // ---------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------
  function toggleFavorite(id) {
    const i = favorites.indexOf(id);
    if (i === -1) favorites.push(id); else favorites.splice(i, 1);
    saveJSON(K.favorites, favorites);
    renderFavorites();
  }
  function renderFavorites() {
    const wrap = $('favoritesChips');
    wrap.innerHTML = '';
    $('favEmpty').style.display = favorites.length ? 'none' : '';
    favorites.forEach((id) => {
      const r = recipeById(id); if (!r) return;
      const chip = document.createElement('button');
      chip.className = 'chip active'; chip.type = 'button';
      chip.textContent = r.emoji + ' ' + r.title;
      chip.addEventListener('click', () => openRecipeModal(id));
      wrap.appendChild(chip);
    });
  }

  // ---------------------------------------------------------------
  // Shopping list
  // ---------------------------------------------------------------
  function findPrice(name) {
    const n = name.toLowerCase();
    for (const row of window.MEALS_PRICES) { if (row.m.some((k) => n.indexOf(k) !== -1)) return row; }
    return { unit:'g', price:2.50 };
  }
  function findAisle(name) {
    const n = name.toLowerCase();
    for (const row of window.MEALS_AISLES) { if (row.m.some((k) => n.indexOf(k) !== -1)) return row.aisle; }
    return 'Other';
  }
  function lineCost(name, qty, unit) {
    const p = findPrice(name);
    if (unit === 'g' && p.unit === 'g') return (qty / 1000) * p.price;
    if (unit === 'ml' && p.unit === 'ml') return (qty / 1000) * p.price;
    if (unit === p.unit) return qty * p.price;
    return qty * (p.price / (p.unit === 'g' || p.unit === 'ml' ? 1000 : 1));
  }
  function buildShoppingList() {
    if (!plan || !profile) return { aisles:{}, total:0, pantrySavings:0, mealCount:{} };
    const merged = {}; // key: name|unit
    const mealCount = {};
    plan.days.forEach((d) => {
      const r = recipeById(d.recipeId);
      if (!r) return;
      r.ingredients.forEach((ing) => {
        const name = ing[0]; const qty = ing[1] * profile.people; const unit = ing[2];
        const key = name + '|' + unit;
        if (!merged[key]) merged[key] = { name, qty: 0, unit };
        merged[key].qty += qty;
        mealCount[name] = (mealCount[name] || 0) + 1;
      });
    });
    // subtract pantry
    let pantrySavings = 0;
    const pantryNote = [];
    Object.values(merged).forEach((item) => {
      const match = pantry.find((p) => p.unit === item.unit && item.name.toLowerCase().indexOf(p.name) !== -1);
      if (match) {
        const used = Math.min(match.qty, item.qty);
        pantrySavings += lineCost(item.name, used, item.unit);
        item.qty = Math.max(0, item.qty - match.qty);
        if (used > 0) pantryNote.push(item.name);
      }
    });
    const aisles = {};
    let total = 0;
    Object.values(merged).forEach((item) => {
      if (item.qty <= 0) return;
      const aisle = findAisle(item.name);
      const cost = lineCost(item.name, item.qty, item.unit) * window.MEALS_SUPERMARKETS[profile.supermarket].mult;
      total += cost;
      if (!aisles[aisle]) aisles[aisle] = [];
      aisles[aisle].push({ name: item.name, qty: Math.round(item.qty * 10) / 10, unit: item.unit, cost, reuse: mealCount[item.name] || 1 });
    });
    return { aisles, total, pantrySavings, pantryNote };
  }
  function renderShoppingList() {
    const data = buildShoppingList();
    const wrap = $('shoppingAisles');
    wrap.innerHTML = '';
    const aisleNames = Object.keys(data.aisles);
    if (!aisleNames.length) { wrap.innerHTML = '<div class="empty-state">Generate a week to build your shopping list.</div>'; }
    aisleNames.sort().forEach((aisle) => {
      const group = document.createElement('div'); group.className = 'aisle-group';
      const h = document.createElement('h4'); h.textContent = aisle; group.appendChild(h);
      data.aisles[aisle].forEach((item) => {
        const row = document.createElement('div'); row.className = 'gm-row';
        const sub = window.MEALS_SUBSTITUTES[item.name.toLowerCase()];
        const expensive = item.cost > 2.5;
        row.innerHTML = '<div class="gm-text">' + item.name + ' — ' + item.qty + item.unit +
          (item.reuse > 1 ? '<span class="badge">×' + item.reuse + ' meals</span>' : '') +
          (expensive ? '<span class="badge warn">£' + item.cost.toFixed(2) + '</span>' : '') +
          (expensive && sub ? '<small>💡 Try ' + sub + ' to save money</small>' : '') + '</div>';
        group.appendChild(row);
      });
      wrap.appendChild(group);
    });
    $('shoppingTotalLine').innerHTML = 'Estimated total: <b>£' + data.total.toFixed(2) + '</b>' + (profile ? ' at ' + window.MEALS_SUPERMARKETS[profile.supermarket].label : '');
    $('pantryCoveredLine').textContent = (data.pantryNote && data.pantryNote.length) ? 'Already covered by pantry: ' + data.pantryNote.join(', ') + ' (saved ~£' + data.pantrySavings.toFixed(2) + ')' : '';
  }
  $('printShopBtn').addEventListener('click', () => window.print());
  $('printPlanBtn').addEventListener('click', () => window.print());

  // ---------------------------------------------------------------
  // Prep schedule
  // ---------------------------------------------------------------
  function buildPrepSchedule() {
    if (!plan) return [];
    const counts = {};
    plan.days.forEach((d) => {
      const r = recipeById(d.recipeId); if (!r) return;
      r.ingredients.forEach((ing) => {
        const name = ing[0];
        counts[name] = counts[name] || new Set();
        counts[name].add(d.day);
      });
    });
    const tasks = [];
    Object.keys(counts).forEach((name) => {
      if (counts[name].size < 2) return;
      const lower = name.toLowerCase();
      let label, mins;
      if (/chicken|beef|turkey|pork|fish|salmon|prawns|tofu|steak/.test(lower)) { label = 'Batch-cook / marinate ' + name; mins = 20; }
      else if (/rice|pasta|quinoa|noodles|lentils/.test(lower)) { label = 'Cook ' + name + ' in bulk'; mins = 15; }
      else if (/onion|pepper|carrot|broccoli|potato|cabbage/.test(lower)) { label = 'Chop / roast ' + name; mins = 12; }
      else { label = 'Prep ' + name; mins = 10; }
      tasks.push({ label, mins, days: Array.from(counts[name]) });
    });
    return tasks;
  }
  function renderPrepSchedule() {
    const tasks = buildPrepSchedule();
    const list = $('prepList');
    list.innerHTML = '';
    if (!tasks.length) { const li = document.createElement('li'); li.className = 'empty-state'; li.textContent = 'No shared ingredients across the week yet — generate a plan first.'; list.appendChild(li); return; }
    tasks.forEach((t) => {
      const li = document.createElement('li'); li.className = 'gm-row';
      const txt = document.createElement('div'); txt.className = 'gm-text';
      txt.innerHTML = t.label + '<small>~' + t.mins + ' min · used on ' + t.days.join(', ') + '</small>';
      li.appendChild(txt); list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------
  // Budget & nutrition
  // ---------------------------------------------------------------
  function renderBudgetNutrition() {
    const data = buildShoppingList();
    $('bgTotal').textContent = '£' + data.total.toFixed(2);
    $('bgBudget').textContent = profile ? '£' + profile.budget : '£0';
    if (plan) {
      const recipes = plan.days.map((d) => recipeById(d.recipeId)).filter(Boolean);
      const avgCal = recipes.reduce((s, r) => s + r.cal, 0) / (recipes.length || 1);
      const avgProtein = recipes.reduce((s, r) => s + r.protein, 0) / (recipes.length || 1);
      $('bgAvgCal').textContent = Math.round(avgCal);
      $('bgAvgProtein').textContent = Math.round(avgProtein) + 'g';
    } else { $('bgAvgCal').textContent = '0'; $('bgAvgProtein').textContent = '0g'; }
    if (profile) {
      const lines = Object.keys(window.MEALS_SUPERMARKETS).map((k) => {
        const sm = window.MEALS_SUPERMARKETS[k];
        const est = (data.total / (window.MEALS_SUPERMARKETS[profile.supermarket].mult || 1)) * sm.mult;
        return sm.label + ': £' + est.toFixed(2);
      });
      $('supermarketCompareLine').innerHTML = 'Estimated total by supermarket — ' + lines.join(' · ');
    }
  }

  // ---------------------------------------------------------------
  // History
  // ---------------------------------------------------------------
  function renderHistory() {
    const list = $('historyList');
    list.innerHTML = '';
    if (!history.length) { const li = document.createElement('li'); li.className = 'empty-state'; li.textContent = 'No past weeks yet.'; list.appendChild(li); return; }
    history.slice().reverse().forEach((h) => {
      const recipes = h.days.map((d) => recipeById(d.recipeId)).filter(Boolean);
      const cost = recipes.reduce((s, r) => s + r.cost * (profile ? profile.people : 1), 0);
      const li = document.createElement('li'); li.className = 'gm-row';
      const txt = document.createElement('div'); txt.className = 'gm-text';
      txt.innerHTML = 'Week of ' + h.weekStart + '<small>' + recipes.map((r) => r.emoji).join(' ') + ' · est. £' + cost.toFixed(2) + '</small>';
      li.appendChild(txt); list.appendChild(li);
    });
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  function renderAll() {
    renderProfileSummary(); renderFamily(); renderPantry();
    renderWeek(); renderFavorites(); renderShoppingList();
    renderPrepSchedule(); renderBudgetNutrition(); renderHistory();
  }
  fillProfileForm();
  renderAll();

  window.addEventListener('storage', () => {
    profile = loadJSON(K.profile, profile);
    family = loadJSON(K.family, family);
    pantry = loadJSON(K.pantry, pantry);
    favorites = loadJSON(K.favorites, favorites);
    plan = loadJSON(K.plan, plan);
    history = loadJSON(K.history, history);
    renderAll();
  });
})();
