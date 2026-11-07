// Starter recipes so the app isn't empty on day one. They're tagged "sample"
// and can be removed in one tap from Settings.

const ALL = true; // the recipe uses the whole package

const r = (id, name, ingredients, notes = '') => ({
  id: `sample-${id}`,
  name,
  notes,
  ingredients: ingredients.map(([amount, name, all]) => ({ amount, name, ...(all ? { usesAll: true } : {}) })),
});

export const SAMPLE_RECIPES = [
  r('stirfry', 'Chicken Stir Fry', [
    ['1 lb', 'Chicken breast', ALL], ['2', 'Bell peppers'], ['1', 'Yellow onion'],
    ['1 head', 'Broccoli'], ['3 cloves', 'Garlic'], ['3 tbsp', 'Soy sauce'],
    ['2 cups', 'Rice'], ['1 tbsp', 'Vegetable oil'],
  ], 'Cook rice first. Stir fry chicken until browned, add veggies, then sauce.'),
  r('tacos', 'Beef Tacos', [
    ['1 lb', 'Ground beef', ALL], ['1 packet', 'Taco seasoning', ALL], ['8', 'Tortillas'],
    ['1 cup', 'Cheddar cheese'], ['1', 'Tomato'], ['1/2 head', 'Lettuce'], ['', 'Sour cream'],
  ]),
  r('friedrice', 'Fried Rice', [
    ['3 cups', 'Rice'], ['2', 'Eggs'], ['1 cup', 'Frozen peas'], ['1', 'Carrot'],
    ['1', 'Yellow onion'], ['2 tbsp', 'Soy sauce'], ['2 cloves', 'Garlic'],
  ], 'Day-old rice works best.'),
  r('fajitas', 'Chicken Fajitas', [
    ['1 lb', 'Chicken breast', ALL], ['3', 'Bell peppers'], ['1', 'Yellow onion'],
    ['8', 'Tortillas'], ['1 packet', 'Fajita seasoning', ALL], ['', 'Sour cream'], ['1', 'Lime'],
  ]),
  r('spaghetti', 'Spaghetti & Meat Sauce', [
    ['1 lb', 'Spaghetti', ALL], ['1 lb', 'Ground beef', ALL], ['1 jar', 'Marinara sauce', ALL],
    ['1', 'Yellow onion'], ['3 cloves', 'Garlic'], ['', 'Parmesan cheese'],
  ]),
  r('omelette', 'Veggie Omelette', [
    ['3', 'Eggs'], ['1/2', 'Bell peppers'], ['1/4', 'Yellow onion'],
    ['1/4 cup', 'Cheddar cheese'], ['1 handful', 'Spinach'], ['1 tbsp', 'Butter'],
  ]),
  r('chili', 'Chili', [
    ['1 lb', 'Ground beef', ALL], ['2 cans', 'Kidney beans', ALL], ['1 can', 'Diced tomatoes', ALL],
    ['1', 'Yellow onion'], ['1', 'Bell peppers'], ['2 tbsp', 'Chili powder'],
    ['', 'Cheddar cheese'], ['', 'Sour cream'],
  ]),
  r('quesadillas', 'Chicken Quesadillas', [
    ['1 lb', 'Chicken breast', ALL], ['6', 'Tortillas'], ['2 cups', 'Cheddar cheese'],
    ['1', 'Bell peppers'], ['', 'Salsa'], ['', 'Sour cream'],
  ]),
];
