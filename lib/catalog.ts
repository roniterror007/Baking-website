export type Product = {
  id: string; name: string; category: "Cakes" | "Brownies" | "Blondies";
  collection: string; description: string;
  /** INR before size multiplier. Cakes: 0.5 kg. Brownies/blondies: box of 4. */
  price: number; image: string; featured: boolean; available: boolean;
};

export const CATEGORIES = ["Sponge cakes", "Cheesecakes", "Mithai cakes", "Brownies", "Blondies"];
export const DEFAULT_SETTINGS = { banner: "Handcrafted in Bangalore. Made for your sweetest moments.", columns: 4 };

const item = (id: string, name: string, category: Product["category"], collection: string,
  description: string, price: number, featured = false): Product => ({
  id, name, category, collection, description, price, featured, available: true,
  image: category === "Cakes" && collection !== "Cheesecakes" ? "/images/hero-cake.webp" : "/images/bakery-selection.webp",
});

export const INITIAL_PRODUCTS: Product[] = [
  item("vanilla-sponge", "Vanilla sponge cake", "Cakes", "Sponge cakes", "Cloud-soft vanilla sponge, finished with a silky cream frosting.", 650, true),
  item("chocolate-sponge", "Chocolate sponge cake", "Cakes", "Sponge cakes", "Rich cocoa sponge with layers of smooth chocolate frosting.", 750),
  item("mango-cake", "Mango cake", "Cakes", "Sponge cakes", "Golden mango, delicate sponge and a sunny fruit finish.", 850),
  item("orange-nugget", "Orange nugget cake", "Cakes", "Sponge cakes", "Bright orange zest with little bursts of citrus in every bite.", 750),
  item("pineapple-cake", "Pineapple cake", "Cakes", "Sponge cakes", "Juicy pineapple layered with fresh cream and tender sponge.", 700),
  item("new-york-cheesecake", "Baked New York cheese cake", "Cakes", "Cheesecakes", "A classic baked cheesecake with a buttery biscuit foundation.", 1100),
  item("biscoff-cheesecake", "No bake creamy biscoff cheese cake", "Cakes", "Cheesecakes", "Caramelised Biscoff meets a luxuriously creamy cheesecake.", 1250, true),
  item("mango-cheesecake", "Frozen layered mango cheese cake", "Cakes", "Cheesecakes", "Beautiful chilled layers of mango and creamy cheesecake.", 1200),
  item("blueberry-cheesecake", "No bake white chocolate blueberry cheese cake", "Cakes", "Cheesecakes", "White chocolate cream with a jewel-bright blueberry swirl.", 1300),
  item("ferrero-cheesecake", "Ferrero rocher cheese cake", "Cakes", "Cheesecakes", "Chocolate, hazelnut and Ferrero Rocher in a decadent cheesecake.", 1400),
  item("lemon-cheesecake", "Baked lemon cheese cake", "Cakes", "Cheesecakes", "A gently baked cheesecake with a refreshing lemon finish.", 1150),
  item("tiramisu-cheesecake", "Tiramisu cheese cake", "Cakes", "Cheesecakes", "Coffee-kissed layers inspired by the beloved Italian dessert.", 1350),
  item("gulab-jamun-cheesecake", "Gulab jamun fusion cheese cake", "Cakes", "Cheesecakes", "Soft gulab jamun woven into a celebration of creamy cheesecake.", 1350),
  item("rasmalai-fusion", "Rasmalai fusion cake", "Cakes", "Mithai cakes", "Saffron, pistachio and fragrant rasmalai in a festive fusion cake.", 1100),
  item("rose-nuts-blondies", "Rose nuts blondies", "Blondies", "Blondies", "Buttery blondies with fragrant rose and a generous scattering of nuts.", 420),
  item("almond-rose-blondies", "Almond rose blondies", "Blondies", "Blondies", "Golden almond blondies with a delicate rose finish.", 450),
  item("mango-blondies", "Mango blondies", "Blondies", "Blondies", "Bright mango folded into our soft, golden blondie batter.", 440),
  item("pistachio-almond-blondies", "Pistachio almond blondies", "Blondies", "Blondies", "A buttery nutty square with pistachio and toasted almond.", 480, true),
  item("walnut-brownie", "Walnut chocolate brownie", "Brownies", "Brownies", "Fudgy chocolate brownie with the crunch of toasted walnuts.", 380, true),
  item("red-velvet-brownie", "Red velvet brownie", "Brownies", "Brownies", "A tender red velvet square with a rich cocoa note.", 400),
  item("biscoff-brownie", "Biscoff brownie", "Brownies", "Brownies", "Deep chocolate with a swirl of caramelised biscuit butter.", 450),
  item("cream-cheese-brownie", "Classic cream cheese brownie", "Brownies", "Brownies", "A fudgy chocolate base marbled with tangy cream cheese.", 420),
  item("oreo-brownie", "Fruit and nut oreo brownie", "Brownies", "Brownies", "Oreo, fruit and nuts packed into a generous chocolate square.", 460),
  item("monster-brownie", "Monster brownie", "Brownies", "Brownies", "Our most playful brownie, piled with chocolatey treats.", 500),
  item("sizzler-brownie", "Instant sizzler brownie", "Brownies", "Brownies", "Rich brownie made for warming and serving with your favourite scoop.", 450),
  item("coconut-brownie", "Coconut brownie", "Brownies", "Brownies", "Dark chocolate and soft coconut in a fragrant fudgy square.", 400),
  item("triple-chocolate-brownie", "Chocolate triple overload brownie", "Brownies", "Brownies", "Three layers of chocolate pleasure in one indulgent brownie.", 480),
  item("healthy-brownie", "Healthy brownie", "Brownies", "Brownies", "A thoughtfully balanced brownie with a deep cocoa flavour.", 440),
];
