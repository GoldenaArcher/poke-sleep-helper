import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";

const dbPath = process.env.SQLITE_PATH || "data/poke-sleep.sqlite";
const resolvedPath = path.resolve(dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new sqlite3.Database(resolvedPath);

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

const dishCatalog = [
  {
    name: "Mixed Salad",
    type: "salad",
    description: "Any combination that doesn't match a recipe",
    ingredients: []
  },
  {
    name: "Slowpoke Tail Pepper Salad",
    type: "salad",
    description:
      "The mouth-tinglingly spicy pepper highlights the sweetness of the tail.",
    ingredients: [
      { name: "Slowpoke Tail", quantity: 10 },
      { name: "Fiery Herb", quantity: 10 },
      { name: "Pure Oil", quantity: 15 }
    ]
  },
  {
    name: "Spore Mushroom Salad",
    type: "salad",
    description: "A salad rich in minerals that improve the quality of sleep.",
    ingredients: [
      { name: "Tasty Mushroom", quantity: 17 },
      { name: "Snoozy Tomato", quantity: 8 },
      { name: "Pure Oil", quantity: 8 }
    ]
  },
  {
    name: "Snow Cloak Caesar Salad",
    type: "salad",
    description:
      "A bacon salad topped with a generous snowy sprinkling of cheese.",
    ingredients: [
      { name: "Moomoo Milk", quantity: 10 },
      { name: "Bean Sausage", quantity: 6 }
    ]
  },
  {
    name: "Gluttony Potato Salad",
    type: "salad",
    description:
      "This potato salad contains just a hint of flavor from the Fancy Apples.",
    ingredients: [
      { name: "Soft Potato", quantity: 14 },
      { name: "Fancy Egg", quantity: 9 },
      { name: "Bean Sausage", quantity: 7 },
      { name: "Fancy Apple", quantity: 6 }
    ]
  },
  {
    name: "Water Veil Tofu Salad",
    type: "salad",
    description: "A salad topped with wobbly cubes of tofu.",
    ingredients: [
      { name: "Greengrass Soybeans", quantity: 15 },
      { name: "Snoozy Tomato", quantity: 9 }
    ]
  },
  {
    name: "Superpower Extreme Salad",
    type: "salad",
    description:
      "A hefty salad that provides all your daily nutrients at once.",
    ingredients: [
      { name: "Bean Sausage", quantity: 9 },
      { name: "Warming Ginger", quantity: 6 },
      { name: "Fancy Egg", quantity: 5 },
      { name: "Soft Potato", quantity: 3 }
    ]
  },
  {
    name: "Bean Ham Salad",
    type: "salad",
    description: "This simple salad features ham made from Bean Sausages.",
    ingredients: [{ name: "Bean Sausage", quantity: 8 }]
  },
  {
    name: "Snoozy Tomato Salad",
    type: "salad",
    description:
      "The Snoozy Tomatoes in this simple salad are a great aid for sleep.",
    ingredients: [{ name: "Snoozy Tomato", quantity: 8 }]
  },
  {
    name: "Moomoo Caprese Salad",
    type: "salad",
    description:
      "A basic salad containing only cheese, tomatoes, and a splash of oil.",
    ingredients: [
      { name: "Moomoo Milk", quantity: 12 },
      { name: "Snoozy Tomato", quantity: 6 },
      { name: "Pure Oil", quantity: 5 }
    ]
  },
  {
    name: "Contrary Chocolate Meat Salad",
    type: "salad",
    description:
      "The savory sauce and sweet chocolate sauce let you enjoy a mix of flavors.",
    ingredients: [
      { name: "Soothing Cacao", quantity: 14 },
      { name: "Bean Sausage", quantity: 9 }
    ]
  },
  {
    name: "Overheat Ginger Salad",
    type: "salad",
    description:
      "This salad's special ginger dressing warms you through and through.",
    ingredients: [
      { name: "Fiery Herb", quantity: 17 },
      { name: "Warming Ginger", quantity: 10 },
      { name: "Snoozy Tomato", quantity: 8 }
    ]
  },
  {
    name: "Fancy Apple Salad",
    type: "salad",
    description: "A simple salad accentuated by a mashed apple dressing.",
    ingredients: [{ name: "Fancy Apple", quantity: 8 }]
  },
  {
    name: "Immunity Leek Salad",
    type: "salad",
    description: "The crisp leeks in this salad do wonders for the immune system.",
    ingredients: [
      { name: "Large Leek", quantity: 10 },
      { name: "Warming Ginger", quantity: 5 }
    ]
  },
  {
    name: "Dazzling Apple Cheese Salad",
    type: "salad",
    description:
      "The simple seasoning keeps the focus on the sublime pairing of ingredients.",
    ingredients: [
      { name: "Fancy Apple", quantity: 15 },
      { name: "Moomoo Milk", quantity: 5 },
      { name: "Pure Oil", quantity: 3 }
    ]
  },
  {
    name: "Ninja Salad",
    type: "salad",
    description:
      "Ninjas cannot resist the flavor of this tofu salad. It's eaten in a flash!",
    ingredients: [
      { name: "Large Leek", quantity: 15 },
      { name: "Greengrass Soybeans", quantity: 19 },
      { name: "Tasty Mushroom", quantity: 12 },
      { name: "Warming Ginger", quantity: 11 }
    ]
  },
  {
    name: "Heat Wave Tofu Salad",
    type: "salad",
    description: "A tofu salad covered in bright red spicy sauce.",
    ingredients: [
      { name: "Greengrass Soybeans", quantity: 10 },
      { name: "Fiery Herb", quantity: 6 }
    ]
  },
  {
    name: "Greengrass Salad",
    type: "salad",
    description:
      "A salad made of fresh vegetables - all harvested on Greengrass Isle.",
    ingredients: [
      { name: "Pure Oil", quantity: 22 },
      { name: "Greengrass Corn", quantity: 17 },
      { name: "Snoozy Tomato", quantity: 14 },
      { name: "Soft Potato", quantity: 9 }
    ]
  },
  {
    name: "Calm Mind Fruit Salad",
    type: "salad",
    description:
      "The refreshing sweetness of this fruit salad soothes the soul.",
    ingredients: [
      { name: "Fancy Apple", quantity: 21 },
      { name: "Honey", quantity: 16 },
      { name: "Greengrass Corn", quantity: 12 }
    ]
  },
  {
    name: "Fury Attack Corn Salad",
    type: "salad",
    description:
      "When eating this salad, you should start by attacking the mound of corn.",
    ingredients: [
      { name: "Greengrass Corn", quantity: 9 },
      { name: "Pure Oil", quantity: 8 }
    ]
  },
  {
    name: "Cross Chop Salad",
    type: "salad",
    description:
      "A chopped salad delicately made with fine repeated cuts.",
    ingredients: [
      { name: "Fancy Egg", quantity: 20 },
      { name: "Bean Sausage", quantity: 15 },
      { name: "Greengrass Corn", quantity: 11 },
      { name: "Snoozy Tomato", quantity: 10 }
    ]
  },
  {
    name: "Defiant Coffee-Dressed Salad",
    type: "salad",
    description:
      "A chef worked defiantly to perfect this salad with coffee dressing, tweaking the recipe again and again.",
    ingredients: [
      { name: "Rousing Coffee", quantity: 28 },
      { name: "Bean Sausage", quantity: 28 },
      { name: "Pure Oil", quantity: 22 },
      { name: "Soft Potato", quantity: 22 }
    ]
  },
  {
    name: "Petal Blizzard Layered Salad",
    type: "salad",
    description:
      "The sprinkling of egg-fluffy like flower petals-has a delicate texture.",
    ingredients: [
      { name: "Fancy Egg", quantity: 25 },
      { name: "Pure Oil", quantity: 17 },
      { name: "Soft Potato", quantity: 15 },
      { name: "Bean Sausage", quantity: 12 }
    ]
  },
  {
    name: "Apple Acid Yogurt-Dressed Salad",
    type: "salad",
    description:
      "The acidity of the apple vinegar and the yogurt make this salad temptingly tasty.",
    ingredients: [
      { name: "Fancy Egg", quantity: 35 },
      { name: "Fancy Apple", quantity: 28 },
      { name: "Snoozy Tomato", quantity: 23 },
      { name: "Moomoo Milk", quantity: 18 }
    ]
  },
  {
    name: "Luscious Avocado Salad",
    type: "salad",
    description:
      "The soft ingredients gently crumble in your mouth.",
    ingredients: [
      { name: "Glossy Avocado", quantity: 14 },
      { name: "Greengrass Soybeans", quantity: 18 },
      { name: "Pure Oil", quantity: 10 }
    ]
  },
  {
    name: "Bulldoze Guacamole and Chips",
    type: "salad",
    description:
      "You can enjoy the crunchy, aromatic corn chips with the dip's smooth texture.",
    ingredients: [
      { name: "Glossy Avocado", quantity: 28 },
      { name: "Greengrass Corn", quantity: 25 },
      { name: "Fiery Herb", quantity: 30 },
      { name: "Greengrass Soybeans", quantity: 22 }
    ]
  },
  {
    name: "Mixed Curry",
    type: "curry",
    description: "Any combination that doesn't match a recipe",
    ingredients: []
  },
  {
    name: "Fancy Apple Curry",
    type: "curry",
    description:
      "A simple curry that lets the natural sweetness of its apples shine.",
    ingredients: [{ name: "Fancy Apple", quantity: 7 }]
  },
  {
    name: "Grilled Tail Curry",
    type: "curry",
    description:
      "The tasty tail elevates the flavor of the curry roux to the next level.",
    ingredients: [
      { name: "Slowpoke Tail", quantity: 8 },
      { name: "Fiery Herb", quantity: 25 }
    ]
  },
  {
    name: "Solar Power Tomato Curry",
    type: "curry",
    description:
      "A curry made using tomatoes that have turned bright red in the sun.",
    ingredients: [
      { name: "Snoozy Tomato", quantity: 10 },
      { name: "Fiery Herb", quantity: 5 }
    ]
  },
  {
    name: "Dream Eater Butter Curry",
    type: "curry",
    description:
      "The ingredients in this curry all share a connection to deep sleep.",
    ingredients: [
      { name: "Soft Potato", quantity: 18 },
      { name: "Snoozy Tomato", quantity: 15 },
      { name: "Soothing Cacao", quantity: 12 },
      { name: "Moomoo Milk", quantity: 10 }
    ]
  },
  {
    name: "Spicy Leek Curry",
    type: "curry",
    description:
      "The roasted leeks are fragrant and sweet as fruit, perfectly balancing the spicy roux.",
    ingredients: [
      { name: "Large Leek", quantity: 14 },
      { name: "Warming Ginger", quantity: 10 },
      { name: "Fiery Herb", quantity: 8 }
    ]
  },
  {
    name: "Spore Mushroom Curry",
    type: "curry",
    description:
      "A curry that puts you to sleep just as surely as the move Spore.",
    ingredients: [
      { name: "Tasty Mushroom", quantity: 14 },
      { name: "Soft Potato", quantity: 9 }
    ]
  },
  {
    name: "Egg Bomb Curry",
    type: "curry",
    description:
      "A curry made with oodles of love. Its ingredients are geared toward kids.",
    ingredients: [
      { name: "Honey", quantity: 12 },
      { name: "Fancy Apple", quantity: 11 },
      { name: "Fancy Egg", quantity: 8 },
      { name: "Soft Potato", quantity: 4 }
    ]
  },
  {
    name: "Hearty Cheeseburger Curry",
    type: "curry",
    description:
      "This voluminous curry is large enough to astound even a Snorlax.",
    ingredients: [
      { name: "Moomoo Milk", quantity: 8 },
      { name: "Bean Sausage", quantity: 8 }
    ]
  },
  {
    name: "Soft Potato Chowder",
    type: "curry",
    description:
      "A thick chowder made from potatoes boiled until practically melting.",
    ingredients: [
      { name: "Moomoo Milk", quantity: 10 },
      { name: "Soft Potato", quantity: 8 },
      { name: "Tasty Mushroom", quantity: 4 }
    ]
  },
  {
    name: "Simple Chowder",
    type: "curry",
    description:
      "You can really taste the richness of the milk in this simple chowder.",
    ingredients: [{ name: "Moomoo Milk", quantity: 7 }]
  },
  {
    name: "Beanburger Curry",
    type: "curry",
    description:
      "The tender bean patties are the stars of the show in this curry.",
    ingredients: [{ name: "Bean Sausage", quantity: 7 }]
  },
  {
    name: "Mild Honey Curry",
    type: "curry",
    description: "A mild curry containing plenty of honey. Kids gobble it down!",
    ingredients: [{ name: "Honey", quantity: 7 }]
  },
  {
    name: "Ninja Curry",
    type: "curry",
    description:
      "This tofu curry is said to have been a favorite dish of ninjas.",
    ingredients: [
      { name: "Greengrass Soybeans", quantity: 24 },
      { name: "Bean Sausage", quantity: 9 },
      { name: "Large Leek", quantity: 12 },
      { name: "Tasty Mushroom", quantity: 5 }
    ]
  },
  {
    name: "Drought Katsu Curry",
    type: "curry",
    description:
      "The freshly-fried cutlet has a nice sparkle to it.",
    ingredients: [
      { name: "Bean Sausage", quantity: 10 },
      { name: "Pure Oil", quantity: 5 }
    ]
  },
  {
    name: "Melty Omelette Curry",
    type: "curry",
    description:
      "This curry is topped with a masterfully-cooked omelette that simply melts in the mouth.",
    ingredients: [
      { name: "Fancy Egg", quantity: 10 },
      { name: "Snoozy Tomato", quantity: 6 }
    ]
  },
  {
    name: "Bulk Up Bean Curry",
    type: "curry",
    description:
      "A hearty curry packed with nutrients needed for bulking up.",
    ingredients: [
      { name: "Greengrass Soybeans", quantity: 12 },
      { name: "Bean Sausage", quantity: 6 },
      { name: "Fiery Herb", quantity: 4 },
      { name: "Fancy Egg", quantity: 4 }
    ]
  },
  {
    name: "Limber Corn Stew",
    type: "curry",
    description:
      "The milk and corn in this creamy stew have a mild, gentle sweetness.",
    ingredients: [
      { name: "Greengrass Corn", quantity: 14 },
      { name: "Moomoo Milk", quantity: 8 },
      { name: "Soft Potato", quantity: 8 }
    ]
  },
  {
    name: "Inferno Corn Keema Curry",
    type: "curry",
    description:
      "This curry's infernal spiciness kicks in after the sweetness of the corn.",
    ingredients: [
      { name: "Fiery Herb", quantity: 27 },
      { name: "Bean Sausage", quantity: 24 },
      { name: "Greengrass Corn", quantity: 14 },
      { name: "Warming Ginger", quantity: 12 }
    ]
  },
  {
    name: "Dizzy Punch Spicy Curry",
    type: "curry",
    description:
      "A rhythmic one-two punch of sweet and spicy flavors attacks your taste buds, finishing with a hint of bitterness.",
    ingredients: [
      { name: "Rousing Coffee", quantity: 11 },
      { name: "Fiery Herb", quantity: 11 },
      { name: "Honey", quantity: 11 }
    ]
  },
  {
    name: "Hidden Power Perk-Up Stew",
    type: "curry",
    description:
      "A chunky tomato stew for a decadent start to your day.",
    ingredients: [
      { name: "Greengrass Soybeans", quantity: 28 },
      { name: "Snoozy Tomato", quantity: 25 },
      { name: "Tasty Mushroom", quantity: 23 },
      { name: "Rousing Coffee", quantity: 16 }
    ]
  },
  {
    name: "Cut Sukiyaki Curry",
    type: "curry",
    description:
      "A salty-sweet curry with a side of roughly cut leeks and a soft-boiled egg.",
    ingredients: [
      { name: "Large Leek", quantity: 27 },
      { name: "Bean Sausage", quantity: 26 },
      { name: "Honey", quantity: 26 },
      { name: "Fancy Egg", quantity: 22 }
    ]
  },
  {
    name: "Role Play Pumpkaboo Stew",
    type: "curry",
    description:
      "Not only does this stew look adorable, but its nutritional balance is perfect.",
    ingredients: [
      { name: "Plump Pumpkin", quantity: 10 },
      { name: "Bean Sausage", quantity: 16 },
      { name: "Soft Potato", quantity: 18 },
      { name: "Tasty Mushroom", quantity: 25 }
    ]
  },
  {
    name: "Overgrow Avocado Gratin",
    type: "curry",
    description:
      "The rich white sauce and creamy avocado melt together perfectly.",
    ingredients: [
      { name: "Glossy Avocado", quantity: 22 },
      { name: "Soft Potato", quantity: 20 },
      { name: "Moomoo Milk", quantity: 41 },
      { name: "Pure Oil", quantity: 32 }
    ]
  },
  {
    name: "Mixed Juice",
    type: "dessert",
    description: "Any combination that doesn't match a recipe",
    ingredients: []
  },
  {
    name: "Fluffy Sweet Potatoes",
    type: "dessert",
    description:
      "These perfectly ripe potatoes don't rely on honey to deliver a sweet kick.",
    ingredients: [
      { name: "Soft Potato", quantity: 9 },
      { name: "Moomoo Milk", quantity: 5 }
    ]
  },
  {
    name: "Steadfast Ginger Cookies",
    type: "dessert",
    description:
      "These cookies give you the power to tackle hardships without crumbling.",
    ingredients: [
      { name: "Honey", quantity: 14 },
      { name: "Warming Ginger", quantity: 12 },
      { name: "Soothing Cacao", quantity: 5 },
      { name: "Fancy Egg", quantity: 4 }
    ]
  },
  {
    name: "Fancy Apple Juice",
    type: "dessert",
    description:
      "A rich juice containing only the very best apples.",
    ingredients: [{ name: "Fancy Apple", quantity: 8 }]
  },
  {
    name: "Craft Soda Pop",
    type: "dessert",
    description: "A highly carbonated artisan soda.",
    ingredients: [{ name: "Honey", quantity: 9 }]
  },
  {
    name: "Ember Ginger Tea",
    type: "dessert",
    description:
      "Apples have been added to the spicy ginger, helping the tea go down easily.",
    ingredients: [
      { name: "Warming Ginger", quantity: 9 },
      { name: "Fancy Apple", quantity: 7 }
    ]
  },
  {
    name: "Jigglypuff's Fruity Flan",
    type: "dessert",
    description:
      "A very special flan that's as springy as a balloon.",
    ingredients: [
      { name: "Honey", quantity: 20 },
      { name: "Fancy Egg", quantity: 15 },
      { name: "Moomoo Milk", quantity: 10 },
      { name: "Fancy Apple", quantity: 10 }
    ]
  },
  {
    name: "Lovely Kiss Smoothie",
    type: "dessert",
    description:
      "A relaxing drink that soothes your weariness and envelops you in sleep.",
    ingredients: [
      { name: "Fancy Apple", quantity: 11 },
      { name: "Moomoo Milk", quantity: 9 },
      { name: "Honey", quantity: 7 },
      { name: "Soothing Cacao", quantity: 8 }
    ]
  },
  {
    name: "Lucky Chant Apple Pie",
    type: "dessert",
    description:
      "The chunky pieces of apple in this pie are lucky finds!",
    ingredients: [
      { name: "Fancy Apple", quantity: 12 },
      { name: "Moomoo Milk", quantity: 4 }
    ]
  },
  {
    name: "Neroli's Restorative Tea",
    type: "dessert",
    description:
      "A special restorative tea made by Professor Neroli.",
    ingredients: [
      { name: "Warming Ginger", quantity: 11 },
      { name: "Fancy Apple", quantity: 15 },
      { name: "Tasty Mushroom", quantity: 9 }
    ]
  },
  {
    name: "Sweet Scent Chocolate Cake",
    type: "dessert",
    description:
      "Neither people nor Pokémon can resist the lure of this cake's sweet aroma.",
    ingredients: [
      { name: "Honey", quantity: 9 },
      { name: "Soothing Cacao", quantity: 8 },
      { name: "Moomoo Milk", quantity: 7 }
    ]
  },
  {
    name: "Warm Moomoo Milk",
    type: "dessert",
    description:
      "Moomoo Milk that has been heated to further draw out its sweetness.",
    ingredients: [{ name: "Moomoo Milk", quantity: 7 }]
  },
  {
    name: "Cloud Nine Soy Cake",
    type: "dessert",
    description: "A soy cake with a nice, light texture.",
    ingredients: [
      { name: "Fancy Egg", quantity: 8 },
      { name: "Greengrass Soybeans", quantity: 7 }
    ]
  },
  {
    name: "Hustle Protein Smoothie",
    type: "dessert",
    description:
      "A glass of this sweet smoothie goes down a treat after a training session.",
    ingredients: [
      { name: "Greengrass Soybeans", quantity: 15 },
      { name: "Soothing Cacao", quantity: 8 }
    ]
  },
  {
    name: "Stalwart Vegetable Juice",
    type: "dessert",
    description:
      "An easy-to-make juice with natural sweet and sour flavors.",
    ingredients: [
      { name: "Snoozy Tomato", quantity: 9 },
      { name: "Fancy Apple", quantity: 7 }
    ]
  },
  {
    name: "Big Malasada",
    type: "dessert",
    description:
      "A special fried bread made using a recipe from the Alola region.",
    ingredients: [
      { name: "Pure Oil", quantity: 10 },
      { name: "Moomoo Milk", quantity: 7 },
      { name: "Honey", quantity: 6 }
    ]
  },
  {
    name: "Huge Power Soy Donuts",
    type: "dessert",
    description:
      "Soy donuts fried to crisp perfection. They're bodybuilders' friends.",
    ingredients: [
      { name: "Pure Oil", quantity: 12 },
      { name: "Greengrass Soybeans", quantity: 16 },
      { name: "Soothing Cacao", quantity: 7 }
    ]
  },
  {
    name: "Explosion Popcorn",
    type: "dessert",
    description:
      "Prepared in an instant with enough heat to cause an explosion",
    ingredients: [
      { name: "Greengrass Corn", quantity: 15 },
      { name: "Pure Oil", quantity: 14 },
      { name: "Moomoo Milk", quantity: 7 }
    ]
  },
  {
    name: "Teatime Corn Scones",
    type: "dessert",
    description:
      "This flaky scone is most delicious when paired with an equal amount of apple ginger jam.",
    ingredients: [
      { name: "Fancy Apple", quantity: 20 },
      { name: "Warming Ginger", quantity: 20 },
      { name: "Greengrass Corn", quantity: 18 },
      { name: "Moomoo Milk", quantity: 9 }
    ]
  },
  {
    name: "Petal Dance Chocolate Tart",
    type: "dessert",
    description:
      "A tricksy tart that scatters flower petals when you eat it",
    ingredients: [
      { name: "Fancy Apple", quantity: 11 },
      { name: "Soothing Cacao", quantity: 11 }
    ]
  },
  {
    name: "Flower Gift Macarons",
    type: "dessert",
    description:
      "These macarons are perfect to give as a gift - they always make the recipient smile",
    ingredients: [
      { name: "Soothing Cacao", quantity: 25 },
      { name: "Fancy Egg", quantity: 25 },
      { name: "Honey", quantity: 17 },
      { name: "Moomoo Milk", quantity: 10 }
    ]
  },
  {
    name: "Early Bird Coffee Jelly",
    type: "dessert",
    description:
      "This slightly bitter coffee jelly can help wake you up faster.",
    ingredients: [
      { name: "Rousing Coffee", quantity: 16 },
      { name: "Moomoo Milk", quantity: 14 },
      { name: "Honey", quantity: 12 }
    ]
  },
  {
    name: "Zing Zap Spiced Cola",
    type: "dessert",
    description: "This cola’s strong bite will jolt you awake!",
    ingredients: [
      { name: "Fancy Apple", quantity: 35 },
      { name: "Warming Ginger", quantity: 20 },
      { name: "Large Leek", quantity: 20 },
      { name: "Rousing Coffee", quantity: 12 }
    ]
  },
  {
    name: "Mold Breaker Corn Tiramisu",
    type: "dessert",
    description:
      "This tiramisu recipe defies precedent by relying on the sweetness of corn alone.",
    ingredients: [
      { name: "Rousing Coffee", quantity: 14 },
      { name: "Greengrass Corn", quantity: 14 },
      { name: "Moomoo Milk", quantity: 12 }
    ]
  },
  {
    name: "Clodsire Eclair",
    type: "dessert",
    description:
      "A generously filled, bitter éclair with a cheery Clodsire design.",
    ingredients: [
      { name: "Soothing Cacao", quantity: 30 },
      { name: "Moomoo Milk", quantity: 26 },
      { name: "Rousing Coffee", quantity: 24 },
      { name: "Honey", quantity: 22 }
    ]
  },
  {
    name: "Scary Face Pancakes",
    type: "dessert",
    description:
      "The sweetness from the vegetables is nice, but making eye contact with this dish will give you a fright.",
    ingredients: [
      { name: "Plump Pumpkin", quantity: 18 },
      { name: "Fancy Egg", quantity: 24 },
      { name: "Honey", quantity: 32 },
      { name: "Snoozy Tomato", quantity: 29 }
    ]
  },
  {
    name: "Leaf Tornado Smoothie",
    type: "dessert",
    description:
      "This dish is full of nutrients thanks to the sun. It's perfect for breakfast too!",
    ingredients: [
      { name: "Glossy Avocado", quantity: 18 },
      { name: "Snoozy Tomato", quantity: 16 },
      { name: "Moomoo Milk", quantity: 14 }
    ]
  }
];

const initDb = async () => {
  await dbRun("PRAGMA journal_mode = WAL");

  await dbRun(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      description TEXT,
      base_strength INTEGER NOT NULL DEFAULT 0,
      dish_level INTEGER NOT NULL DEFAULT 1
    );
  `);

  const dishColumns = await dbAll("pragma table_info(dishes)");
  const hasDishLevel = dishColumns.some(
    (column) => column.name === "dish_level"
  );
  if (!hasDishLevel) {
    await dbRun("alter table dishes add column dish_level integer default 1");
  }
  await dbRun("update dishes set dish_level = 1 where dish_level is null");

  await dbRun(`
    CREATE TABLE IF NOT EXISTS dish_ingredients (
      dish_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      PRIMARY KEY (dish_id, ingredient_id),
      FOREIGN KEY (dish_id) REFERENCES dishes(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bag_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bag_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0
    );
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  for (const dish of dishCatalog) {
    await dbRun(
      "insert or ignore into dishes (name, type, description, base_strength, dish_level) values (?, ?, ?, 0, 1)",
      [dish.name, dish.type, dish.description]
    );
    const dishRow = await dbGet("select id from dishes where name = ?", [
      dish.name
    ]);
    for (const ingredient of dish.ingredients) {
      await dbRun("insert or ignore into ingredients (name) values (?)", [
        ingredient.name
      ]);
      const ingredientRow = await dbGet(
        "select id from ingredients where name = ?",
        [ingredient.name]
      );
      await dbRun(
        `insert or replace into dish_ingredients
         (dish_id, ingredient_id, quantity)
         values (?, ?, ?)`,
        [dishRow.id, ingredientRow.id, ingredient.quantity]
      );
    }
  }

  const bagColumns = await dbAll("pragma table_info(bag_ingredients)");
  const hasIngredientId = bagColumns.some(
    (column) => column.name === "ingredient_id"
  );
  if (hasIngredientId) {
    await dbRun("alter table bag_ingredients rename to bag_ingredients_old");
    await dbRun(`
      CREATE TABLE bag_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        quantity INTEGER NOT NULL DEFAULT 0
      );
    `);
    await dbRun(`
      insert into bag_ingredients (name, quantity)
      select ingredients.name, bag_ingredients_old.quantity
      from bag_ingredients_old
      join ingredients on ingredients.id = bag_ingredients_old.ingredient_id
      where bag_ingredients_old.quantity > 0
    `);
    await dbRun("drop table bag_ingredients_old");
  }

  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["ingredient_limit", "100"]
  );
  await dbRun(
    "insert or ignore into settings (key, value) values (?, ?)",
    ["item_limit", "100"]
  );

};

export { dbAll, dbGet, dbRun, initDb };
export default db;
