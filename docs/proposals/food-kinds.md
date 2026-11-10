# Food by kind: Ramen, Kushikatsu, Tempura…

Status: **done** (2026-11-10), with Onigiri and Donburi split out of
Rice.

## Why

Food is one category chip for 158 places. Jerry wants to narrow it the
way you'd decide where to eat: ramen, kushikatsu, tempura. Each place
already says what it is in its **Type** column ("Ramen; Tsukemen",
"Kushiage"), from a fixed list of 38 values, but Type isn't a filter:
it shows on the row and the card, and search matches it.

## Proposal

Give Food **kinds**, the category chips Drinks, Sweets, Music and Shops
already have (Filters page → Category: the layer's chip, then its
kinds). Each kind is a group of Type values, so a chip finds every
place of those types:

| Kind | Places | Tokyo · Kyoto · Osaka · Nara · Hakone | Type values |
| --- | --- | --- | --- |
| Ramen | 17 | 6 · 7 · 3 · 1 · 0 | Ramen, Tsukemen, Tantanmen |
| Yakitori | 15 | 7 · 4 · 3 · 1 · 0 | Yakitori |
| Yakiniku | 10 | 5 · 2 · 3 · 0 · 0 | Yakiniku |
| Katsu | 12 | 10 · 1 · 1 · 0 · 0 | Tonkatsu, Gyukatsu, Katsudon |
| Kushikatsu | 6 | 1 · 0 · 5 · 0 · 0 | Kushikatsu, Kushiage |
| Tempura | 13 | 7 · 3 · 2 · 1 · 0 | Tempura, Tendon |
| Gyoza | 11 | 5 · 4 · 2 · 0 · 0 | Gyoza |
| Okonomiyaki | 7 | 2 · 0 · 5 · 0 · 0 | Okonomiyaki, Negiyaki, Monjayaki |
| Hot pot | 11 | 6 · 4 · 1 · 0 · 0 | Sukiyaki, Shabu-shabu |
| Unagi | 10 | 6 · 3 · 1 · 0 · 0 | Unagi |
| Tofu | 8 | 0 · 6 · 0 · 0 · 2 | Yudofu, Tofu, Yuba |
| Rice | 14 | 7 · 3 · 0 · 4 · 0 | Rice, Kamameshi, Donabe rice, Fukagawa-meshi, Chagayu, Teishoku |
| Onigiri | 6 | 4 · 1 · 1 · 0 · 0 | Onigiri |
| Donburi | 5 | 4 · 1 · 0 · 0 · 0 | Donburi, Oyakodon, Kaisendon |
| Sushi | 3 | 0 · 0 · 0 · 3 · 0 | Kakinoha-zushi |
| Pickles | 6 | 0 · 6 · 0 · 0 · 0 | Tsukemono |
| Fruit | 8 | 5 · 1 · 2 · 0 · 0 | Fruit parlor, Fruit sando, Parfait, Strawberries |

Every place lands in at least one kind; 4 land in two (a place of two
types in different kinds matches either chip, as with `Coffee; Bar`):
Dote no Iseya (Tempura, Donburi), Koharuken (Katsu, Donburi), and Doi
and Kintame (Rice, Pickles). Each Type is in one kind: Tendon stays
with Tempura and Katsudon with Katsu; a donburi shop known for them is
also tagged Donburi.

Anything finer (tsukemen only, monjayaki only) stays the search box's
job, which already matches Type.

### Kinds come from Type, not a new column

The other layers name a place's kind in a **Kind** column. For Food the
kind follows from the Type, so a second column would only repeat it and
could disagree with it. Instead, the food layer's config lists which
Type values make up each kind (`FOOD_KINDS` in `src/config/layers.ts`),
and the loader derives each place's kinds from its Type
(`kindsFrom: { column: "Type", groups }` on the layer). The same list
is the Type column's values, so a Type value outside every kind fails
the build, as an unknown value does today, and a new type can't go
unfiled. A row whose Type is blank warns too. Adding a row stays the
same: fill in Type.

The chips, the URL (`c=food/Ramen`), the card's meta line ("Food ·
Ramen · Shibuya") and search all work as for the other layers' kinds,
unchanged. A link from before, `c=food`, still means all of Food,
since a layer id stands for all its chips.

## Files

```
src/data/types.ts           LayerConfig.kindsFrom: kinds derived from a facet column
src/config/layers.ts        FOOD_KINDS: Food's kinds, their Type values, the Type list
src/data/parse.ts           derive a place's kinds; warn on a row with none
src/data/parse.test.ts      the derivation rules; the food data's counts per kind
docs/design/regions-layers-filters.md, adding-places.md, CLAUDE.md
```

No data file changes.

## Decisions (Jerry, 2026-11-10)

- **Rice** splits: Onigiri (6) and Donburi (5) get chips of their own;
  Rice keeps the other rice dishes and set meals (14).
- **Labels:** Katsu, Hot pot and Pickles, as proposed.
- **Sushi** stays its own kind, for sushi places to come.
