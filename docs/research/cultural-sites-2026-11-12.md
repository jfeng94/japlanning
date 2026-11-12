# Cultural sites: findings, 2026-11-12

Findings for 24 classic cultural sites in Tokyo and Kyoto, for the
`activities` layer (the gate in `docs/design/adding-places.md`, section
3). **Written 2026-11-12** as activities:9–32, with every recommendation
below accepted, and the December highlights in each place's new Events
column. Hanatouro (activities:4) was dropped and Tenryu-ji
(activities:5) became an ordinary temple row from tenryuji.com.

Researched by five parallel agents from official sites first (each
temple's own 由緒/沿革 page), then gotokyo.org, kyoto.travel, JNTO and
japan-guide. Pins from OpenStreetMap objects (named gates), cross-checked
with the GSI geocoder. Hours are the ones that apply in **December**.

Edits made while compiling: a typo (Nezu), a research date out of a note
(Imperial Palace), and facts no source supported taken out (the bamboo
grove's torii, Byodo-in's original phoenixes in the museum).

## Decisions for Jerry

1. **Arashiyama Hanatouro ended in 2021.** Rows activities:4 (Hanatouro,
   "Dec 8–17, 2026") and activities:5 (Tenryu-ji, Hanatouro night opening)
   describe an event that no longer runs: the Kyoto City Tourism
   Association held the last one Dec 10–19, 2021
   (pref.kyoto.jp/kanko/news/2021/r3hanatouro.html). Its successor,
   Arashiyama Tsukitouro, runs Sep 30–Nov 8, 2026, before the trip.
   **Recommended:** drop row 4; turn row 5 into an ordinary Tenryu-ji row
   (temple and garden, daytime hours, history), researched in this batch.
2. **Yanaka's pin.** The classic start, the Yuyake Dandan steps, is just
   inside 荒川区, not Yanaka's 台東区. **Recommended:** pin mid–Yanaka
   Ginza (120 m west, 台東区谷中3), area Yanaka. Else a new area
   (Nishi-Nippori, 荒川区) for one place.
3. **New areas** (table below): Komagome, Gotokuji (Tokyo); Ginkakuji,
   Sanjusangendo, Tofukuji (Kyoto).
4. **New Type values** for activities: Temple, Garden, Castle, Walk
   (Shrine and Museum exist).
5. **Pin art.** Shrines get `torii`; temples, gardens, the castle, the
   museum and the walks get `sozu` (the icon list calls both "cultural
   sites"). Temple-specific art would be new artwork.
6. **History for walks.** The Bamboo Grove's history rested on unread
   sources; **recommended:** leave its History blank. Hanamikoji, Yanaka
   and the Philosopher's Path have sourced history and keep it.

## New areas

| Label | Region | Ward | Section | Neighbours | Holds |
| --- | --- | --- | --- | --- | --- |
| Komagome | tokyo | 文京区 | North | none (Sendagi 1.5 km) | Rikugien |
| Gotokuji | tokyo | 世田谷区 | Meguro · Setagaya | none (Kyodo 1.3 km) | Gotoku-ji |
| Ginkakuji | kyoto | 左京区 | Sakyo | Nanzenji, Hyakumanben | Ginkaku-ji, Philosopher's Path |
| Sanjusangendo | kyoto | 東山区 | Higashiyama | Kiyomizu, Gojo | Sanjusangen-do |
| Tofukuji | kyoto | 東山区 | Higashiyama | Fushimi Inari | Tofuku-ji |

Every place is inside its region's map box; no box changes, so no maps
to republish. Existing areas take the rest; a few sit 700–950 m from
their area's other places (Kinkaku-ji in Kinugasa, Imperial Palace East
Gardens in Marunouchi, Hama-rikyu in Tsukiji), so the shape tests may
ask for a `shape` tweak on rebuild.

## Summary

| # | Place | Area | Type | Pin | Hours (Dec) | Src | Conf. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Senso-ji | Asakusa | Temple | Kaminarimon | Grounds always; hall 6:30–17:00 | official | high |
| T2 | Meiji Jingu | Harajuku | Shrine | first torii, south approach | 6:40–16:00 (monthly) | official | high |
| T3 | Imperial Palace East Gardens | Marunouchi | Garden; Castle | Otemon | 9:00–16:00; closed Mon, Fri, Dec 28–Jan 3 | official | high |
| T4 | Tokyo National Museum | Ueno | Museum | main gate | 9:30–17:00, Fri–Sat to 20:00; closed Mon, Dec 15, Dec 26–31 | official | high |
| T5 | Hama-rikyu Gardens | Tsukiji | Garden | Otemon | 9:00–17:00; closed Dec 29–Jan 1 | official | high |
| T6 | Nezu Shrine | Nezu | Shrine | Romon | 6:00–17:00 | official | high |
| T7 | Yanaka | Yanaka | Walk | Yanaka Ginza (decision 2) | always | 3rd party | medium |
| T8 | Rikugien | NEW Komagome | Garden | main gate | 9:00–17:00; closed Dec 29–Jan 1 | official | high |
| T9 | Gotoku-ji | NEW Gotokuji | Temple | Sanmon | 6:00–17:00 | official | high |
| K1 | Kiyomizu-dera | Kiyomizu | Temple | Niomon | 6:00–18:00 | official | high |
| K2 | Yasaka Shrine | Gion | Shrine | West Gate | always | official | high |
| K3 | Hanamikoji | Gion | Walk | Shijo-dori end | always | 3rd party | medium |
| K4 | Sanjusangen-do | NEW Sanjusangendo | Temple | North Gate | 9:00–16:00 | official | high |
| K5 | Tofuku-ji | NEW Tofukuji | Temple; Garden | Nikkamon (visitors' gate) | 9:00–16:00 from Dec 7 | official | high |
| K6 | Kinkaku-ji | Kinugasa | Temple; Garden | Somon | 9:00–17:00 | official | high |
| K7 | Ryoan-ji | Ryoanji | Temple; Garden | Sanmon | 8:30–16:30 | official | high |
| K8 | Ginkaku-ji | NEW Ginkakuji | Temple; Garden | Somon | 9:00–16:30 | official | high |
| K9 | Philosopher's Path | NEW Ginkakuji | Walk | north end, Ginkakuji-bashi | always | 3rd party | medium |
| K10 | Nanzen-ji | Nanzenji | Temple; Garden | Sanmon | 8:40–16:30; closed Dec 28–31 | official | high |
| K11 | Nijo Castle | Nijo | Castle; Garden | East Gate | 8:45–17:00; closed Dec 29–31 | official | high |
| K12 | To-ji | Toji | Temple | Nandaimon | 5:00–17:00 (halls 8:00–) | official | high |
| K13 | Byodo-in | Uji | Temple; Garden | main gate ticket booth | 8:45–17:30 | official | medium (pin) |
| K14 | Arashiyama Bamboo Grove | Arashiyama | Walk | Nonomiya Shrine end | always | 3rd party | medium |
| K15 | Okochi Sanso | Arashiyama | Garden | ticket office | 9:00–17:00 | 3rd party | medium |

## December highlights (for planning, not the rows)

- **Senso-ji:** Hagoita-ichi battledore market Dec 17–19; New Year's Eve bell.
- **Tokyo National Museum:** "Hiroshige: New Perspectives on Edo Japan" to Dec 20; closed Dec 15 and Dec 26–31 (Dec 22–25 only the Horyuji Gallery).
- **Imperial Palace East Gardens:** closed Dec 4, 7, 11, 14, 18, 21, 25 and Dec 28–Jan 3.
- **Rikugien:** foliage night illumination to Dec 6 (18:00–20:30).
- **To-ji:** Shimai-Kobo, the year's last and biggest flea market, Mon Dec 21.
- **Yasaka Shrine:** Okera-mairi on New Year's Eve (very crowded).
- **Nijo Castle:** Ninomaru Palace closed Tuesdays in December and Dec 26–28.
- **Tofuku-ji, Ginkaku-ji, Kiyomizu-dera:** autumn specials end by Dec 6; foliage past peak.
- **Nanzen-ji:** closed Dec 28–31. Nanzen-in sub-temple closed for roof work.

## The rows

Each: position, address, hours (human; OSM), admission and Reservation,
link, then the Notes and History drafts.

### T1. Senso-ji
- 35.711133, 139.796368 (Kaminarimon, OSM way 173154849) · 東京都台東区浅草2-3-1 · Asakusa · Temple · sozu
- Grounds always open; main hall 6:30–17:00 (Oct–Mar) · `24/7` · official (senso-ji.jp/about), Last verified 2026-11-12
- Free · Reservation No · https://www.senso-ji.jp/
- **Notes:** Tokyo's oldest temple, entered through the Kaminarimon with its 700 kg red lantern and the wind and thunder gods on either side. Nakamise, about 250 m of snack and souvenir stalls, leads to the Hozomon and the main hall; come early morning or after dark, when the grounds are quiet and the gate is lit. Five minutes from Asakusa Station; a water bus from Asakusa runs down the Sumida to Hama-rikyu Gardens in about 35 minutes.
- **History:** On 18 March 628, the brothers Hinokuma no Hamanari and Takenari netted a small Kannon statue in the Sumida River; it kept coming back after they threw it in, so the local headman Hajino Nakachi enshrined it, and the temple grew around it. The Kaminarimon, first built in 942, burned four times; after the 1865 fire it went 95 years without a permanent gate, until Konosuke Matsushita, founder of today's Panasonic, paid for the 1960 rebuild. The 10 March 1945 air raid burned the main hall, rebuilt in 1958. Look at the back of the great lantern: it reads Furaijinmon, the gate's original name for its wind and thunder gods.
- Sources: senso-ji.jp/about, senso-ji.jp/annual_event, mlit.go.jp/tagengo-db/en/R1-01373.html, japan-guide e3004 and e3025, gotokyo.org spot 15.

### T2. Meiji Jingu
- 35.670203, 139.701833 (first torii, south approach from JR Harajuku, OSM way 439181113) · 東京都渋谷区代々木神園町1-1 · Harajuku · Shrine · torii
- December 6:40–16:00 (sunrise to sunset; times change monthly) · `Jan 06:40-16:20; Feb 06:20-16:50; Mar 05:40-17:20; Apr 05:10-17:50; May 05:00-18:10; Jun 05:00-18:30; Jul 05:00-18:20; Aug 05:00-18:00; Sep 05:20-17:20; Oct 05:40-16:40; Nov 06:10-16:10; Dec 06:40-16:00` · official, verified
- Free · No · https://www.meijijingu.or.jp/en/
- **Notes:** Tokyo's great shrine, reached by a ten-minute walk on wide gravel paths through a planted forest, steps from the bustle of Harajuku. Halfway in stands the Otorii, 12 m tall and among the largest wooden torii in Japan. Come at opening for a quiet forest, then walk back out to Takeshita-dori and Omotesando.
- **History:** When Emperor Meiji died in 1912 and Empress Shoken in 1914, the public asked for a shrine to them, and Meiji Jingu was dedicated on 1 November 1920 on open land at Yoyogi. Its 70-hectare forest is man-made: about 100,000 trees donated from all over Japan, planted to grow into an "eternal forest". The war destroyed the main buildings, rebuilt in cypress in 1958. The original great torii was split by lightning in 1966; its replacement, from a 1,500-year-old cypress found on Taiwan's Mount Danda, went up on 23 December 1975.
- Sources: meijijingu.or.jp/en/visit, meijijingu.or.jp/about, mlit tagengo-db H30-00516, belca.or.jp prize23-3.pdf, japan-guide e3002.

### T3. Imperial Palace East Gardens
- 35.686110, 139.760211 (Otemon, OSM way 617118937) · 東京都千代田区千代田1 · Marunouchi · Garden; Castle · sozu
- Nov–Feb 9:00–16:00, last entry 15:30; closed Mondays, Fridays and Dec 28–Jan 3 · `Tu-Th,Sa,Su 09:00-16:00; Mo,Fr off; Dec 28-Jan 3 off` · official, verified
- Free · No · https://www.kunaicho.go.jp/e-event/higashigyoen02.html
- **Notes:** The inner circles of Edo Castle, now free gardens behind the old moats, walls and gates: the hilltop Honmaru lawn with the great keep's stone base, surviving guardhouses, and a Japanese garden in the Ninomaru below. Enter by Otemon, a short walk from Otemachi Station or 10 to 15 minutes from Tokyo Station; bags are checked, so travel light. Just inside the gate are the Museum of the Imperial Collections (timed tickets online) and a rest house with a Sarutahiko Coffee.
- **History:** This hill was the heart of Edo Castle, seat of the Tokugawa shoguns who ruled Japan from 1603 to 1867. Its keep, finished in 1638, was the tallest castle tower Japan ever built, but the great fire of 1657 destroyed it and it was never rebuilt; the massive stone base still stands on the Honmaru lawn. Emperor Meiji moved into the castle in 1868, and in 1968 parts of the Honmaru, Ninomaru and Sannomaru were opened to the public as the palace's gardens.
- Sources: kunaicho.go.jp e-event/higashigyoen02 and event/higashigyoen, japan-guide e3018, japan-guide blog 261103_shozokan.
- Open: the Museum of the Imperial Collections (Sannomaru Shozokan, ¥2,500, booking) could be its own row.

### T4. Tokyo National Museum
- 35.717695, 139.775609 (main gate, OSM node 2295385740) · 東京都台東区上野公園13-9 · Ueno · Museum · sozu
- 9:30–17:00, Fridays and Saturdays to 20:00, last entry 30 min before closing; closed Mondays, Dec 15 and Dec 26–31 · `Tu-Th,Su 09:30-17:00; Fr,Sa 09:30-20:00; Mo off; Dec 15 off; Dec 26-31 off` · official, verified
- ¥1,000; special exhibitions extra · Optional · https://www.tnm.jp/?lang=en
- **Notes:** Japan's oldest and largest museum, with about 4,000 works out at a time: the Honkan for Japanese art from Buddhist statues and screens to samurai armour, the Toyokan for the rest of Asia, and the serene Gallery of Horyuji Treasures. It's a 5 to 10 minute walk through Ueno Park from Ueno Station; buy tickets online, since the main-gate counter can queue for over 30 minutes. Fridays and Saturdays it stays open until 20:00, the quietest time to go.
- **History:** The museum began in 1872 with an exhibition in the Taiseiden hall of the Yushima Seido, and moved to Ueno Park, onto the site of Kan'ei-ji's burned main hall, where Emperor Meiji opened Josiah Conder's red-brick main building on 20 March 1882. The Great Kanto Earthquake of 1923 wrecked every gallery except the Hyokeikan of 1909, so the collection carried on there. The present Honkan, a Japanese tiled roof on a concrete body, opened on 10 November 1938. The domed Western-style Hyokeikan beside it is the survivor of the earthquake.
- Sources: tnm.jp pages 113, 143, 150, 152, 153 and the top page; japan-guide e3054_tokyo.

### T5. Hama-rikyu Gardens
- 35.662830, 139.763357 (Otemon, OSM node 5440656466) · 東京都中央区浜離宮庭園1-1 · Tsukiji · Garden · sozu
- 9:00–17:00, last entry 16:30; closed Dec 29–Jan 1 · `09:00-17:00; Dec 29-Jan 1 off` · official, verified
- ¥300 · No · https://www.tokyo-park.or.jp/teien/en/hama-rikyu/
- **Notes:** A shogun's bayside garden whose ponds fill with seawater and rise and fall with the tide, ringed by Shiodome's towers. Rest at the teahouse on the pond's island and look for the reconstructed duck-hunting blinds. About 7 minutes on foot from Shiodome Station; the water bus from Asakusa (about 35 minutes) docks inside the garden, one way only, so pair it with Senso-ji.
- **History:** In 1654 Matsudaira Tsunashige, younger brother of the fourth shogun Ietsuna, filled in part of the Edo Bay shallows to build a seaside villa here. His son Ienobu became the sixth shogun, and the villa passed to the Tokugawa; later shoguns kept reshaping it until the eleventh, Ienari, finished the garden much as it stands today, with its tidal pond and two duck-hunting grounds. It became an imperial detached palace in the Meiji era, was battered by the 1923 earthquake and wartime bombing, and was given to Tokyo on 3 November 1945, opening to the public in April 1946.
- Sources: tokyo-park.or.jp teien/en/hama-rikyu (outline, top), japan-guide e3025.

### T6. Nezu Shrine
- 35.719671, 139.760937 (Romon, OSM way 164586227) · 東京都文京区根津1-28-9 · Nezu · Shrine · torii
- 6:00–17:00 (Nov–Jan); amulet office 9:30–16:30 · `Jan 06:00-17:00; Feb 06:00-17:30; Mar 06:00-18:00; Apr-May 05:30-18:00; Jun-Aug 05:00-18:00; Sep 05:30-18:00; Oct 05:30-17:30; Nov-Dec 06:00-17:00` · official, verified
- Free · No · https://nedujinja.or.jp/
- **Notes:** One of Tokyo's grandest Edo-era shrines, tucked into the backstreets of Yanesen and free to enter. Pass through the Romon gate to the ornate main halls, then follow the path of small vermilion torii up the slope to Otome Inari, a pocket-sized Fushimi Inari above the koi pond. Five minutes from Nezu or Sendagi Station (Chiyoda Line); pair it with a walk through Yanaka.
- **History:** Legend says Yamato Takeru founded the shrine in Sendagi some 1,900 years ago, and Ota Dokan built its halls in the 1470s. In 1706 the fifth shogun, Tokugawa Tsunayoshi, moved it here, onto the estate where his heir, the future shogun Ienobu, was born. The main hall, worship hall, Karamon, fence and Romon finished that year, modelled on Nikko's Toshogu, all still stand as Important Cultural Properties. The azalea slope began in the old estate's garden, and some 3,000 bushes now bloom there each April.
- Sources: nedujinja.or.jp/about, /openclose, /access; gotokyo.org spot 70.

### T7. Yanaka
- 35.727660, 139.766000 (mid–Yanaka Ginza; decision 2) · ~東京都台東区谷中3-13 · Yanaka · Walk · sozu
- Streets always open; most shops 10:00–18:00, many closed Mondays · `24/7` · third party
- Free · No · https://www.gotokyo.org/en/tourists/areas/areamap/yanaka.html
- **Notes:** Tokyo's best-preserved old neighbourhood, a short walk west of Nippori Station: some 70 temples, a leafy cemetery and Yanaka Ginza, a lantern-lined Showa-era shopping street. Start at the top of the Yuyake Dandan steps, which glow at sunset, then snack your way down the street's 170 m on sweet potatoes, pork cutlets and cat-shaped sweets, spotting the Seven Lucky Cats statues as you go; many shops close on Mondays. Loop back through Yanaka Cemetery to the last shogun's grave, or carry on to Nezu Shrine.
- **History:** Yanaka became a temple town after the Meireki Fire of 1657, when temples from Kanda moved out here; some 70 of them still crowd its lanes. Yanaka Cemetery began as the graveyard of Tenno-ji and was split off from it in the Meiji era, and Tokugawa Yoshinobu, the last shogun, lies there. The district came through the 1923 earthquake and the wartime bombing with little damage, which is why so many row houses and old wooden buildings survive, Kayaba Coffee's 1916 house among them.
- Sources: tv-tokyo.co.jp adomachi 20030419, japan-guide e3068, gotokyo.org yanaka.

### T8. Rikugien
- 35.732416, 139.748406 (main gate, OSM node 2237104309) · 東京都文京区本駒込6-16-3 · NEW Komagome · Garden · sozu
- 9:00–17:00, last entry 16:30; closed Dec 29–Jan 1 · `09:00-17:00; Dec 29-Jan 1 off` · official, verified
- ¥300 · No · https://www.tokyo-park.or.jp/teien/en/rikugien/
- **Notes:** One of Tokyo's finest Edo-period stroll gardens: a big pond with islands, wooded hills, bridges and teahouses, with 88 scenes from famous poems laid out along the paths. Its maples are among Tokyo's best in late November and early December; stop for tea at Fukiage Chaya by the pond, and allow about an hour for the loop. Seven minutes' walk south of Komagome Station (JR Yamanote and Namboku lines), with coin lockers big enough for suitcases at the entrance.
- **History:** Yanagisawa Yoshiyasu, a trusted confidant of the fifth shogun Tokugawa Tsunayoshi, was given this land in 1695 and designed the garden himself, digging a pond and raising hills on the flat plain over seven years. A man of letters, he named it for the six forms of waka poetry and laid out 88 scenes from places sung in poems; Edo counted it with Koishikawa Korakuen as its two great gardens. In the Meiji era it passed to Iwasaki Yataro, founder of Mitsubishi, whose family gave it to the city, and it opened to the public on 16 October 1938.
- Sources: tokyo-park.or.jp park/rikugien and teien/en/rikugien (outline, access, news park_info_50), japan-guide e3026.

### T9. Gotoku-ji
- 35.647745, 139.647150 (Sanmon, OSM way 1261872432) · 東京都世田谷区豪徳寺2-24-7 · NEW Gotokuji · Temple · sozu
- Grounds 6:00–17:00; temple office 8:00–15:00 · `06:00-17:00` · official, verified
- Free · No · https://gotokuji.jp/en/
- **Notes:** The temple of the beckoning cat: in front of the Shofukuden hall stand rows upon rows of white maneki-neko, right paw raised, left by people whose wishes came true. Buy your own from the temple office (go early, as they can sell out), then look for the cats hidden in the carvings of the three-storey pagoda. Five minutes' walk from Miyanosaka on the Tokyu Setagaya Line (change at Sangenjaya), or 15 minutes from Odakyu's Gotokuji Station; weekday mornings are quietest.
- **History:** The temple began as Kotokuin in 1480 and became the Edo family temple of the Ii clan, lords of Hikone, after Setagaya came into their domain in 1633. Legend says Ii Naotaka, riding home from falconry, was beckoned in by a cat at the gate just before a thunderstorm broke; grateful for the luck, he backed the temple's rebuilding, and in 1659 it was renamed Gotoku-ji after his Buddhist name. The Buddha hall of 1677 and the bell cast in 1679 still stand, and the Ii cemetery holds Naotaka and Ii Naosuke, the great elder of the shogunate's last years.
- Sources: gotokuji.jp (top, about, en/about, en/manekineko, closing-time notice), gltjp.com article 21460.

### K1. Kiyomizu-dera
- 34.995440, 135.783335 (Niomon, OSM way 102164608) · 京都府京都市東山区清水1-294 · Kiyomizu · Temple · sozu
- 6:00–18:00 · `06:00-18:00; Jul 01-Aug 31 06:00-18:30; Mar 27-Apr 05,Aug 14-Aug 16,Nov 21-Nov 30 06:00-21:30` · official, verified
- ¥500 · No · https://www.kiyomizudera.or.jp/en/
- **Notes:** Kyoto's hillside temple, whose main hall's wooden stage stands 13 m above the trees of Mount Otowa with the whole city beyond. Below the hall, the Otowa Waterfall splits into three streams for longevity, study and love; drink from just one, since taking all three is greedy. Come at the 6:00 opening, before the crowds, then walk down the Sannenzaka and Ninenzaka stone steps toward Gion; it's 10 minutes uphill from the Gojozaka stop on bus 206 from Kyoto Station.
- **History:** Founded in 778, when the monk Kenshin found a pure spring on Mount Otowa; the warrior Sakanoue no Tamuramaro and his wife built the temple and named it Kiyomizu, "pure water". Fire has destroyed most of its buildings more than ten times, and each time the faithful rebuilt them; most of what stands today dates from 1633. The famous stage rests on 18 zelkova pillars joined without a single nail, and the main hall is a National Treasure.
- Sources: kiyomizudera.or.jp/en (location + 2026.json, learn, visit), japan-guide e3901 and e3950_higashiyama_half.

### K2. Yasaka Shrine
- 35.003741, 135.777526 (West Gate, OSM way 105449683) · 京都府京都市東山区祇園町北側625 · Gion · Shrine · torii
- Grounds always open; shrine office 9:00–17:00 · `24/7` · official, verified
- Free · No · https://www.yasaka-jinja.or.jp/en/
- **Notes:** Gion's own shrine, whose vermilion West Gate closes the view up Shijo-dori. Hundreds of lanterns on the dance stage before the main hall, each bearing a local business's name, are lit in the evening, the best time to come. Open all night, so it fits after Kiyomizu-dera (a 20 to 30 minute walk through Higashiyama) and before dinner in Gion, with Maruyama Park next door.
- **History:** By the shrine's own record it goes back to 656, when the Korean envoy Irishi enshrined Susanoo-no-mikoto, the god who wards off calamity. In 869, during an epidemic, 66 halberds were raised, one for each province, in a rite to calm the plague: the first record of the Gion Festival, still held every July. The West Gate went up in 1497, and the main hall, rebuilt in 1654 under shogun Tokugawa Ietsuna after a fire, has been a National Treasure since 2020.
- Sources: yasaka-jinja.or.jp (access, about/history, en, yearly events), japan-guide e3903.

### K3. Hanamikoji
- 35.003837, 135.775067 (Shijo-dori end, OSM node 243798550) · ~京都府京都市東山区祇園町南側 · Gion · Walk · sozu
- Always open · `24/7` · third party
- Free · No · https://www.gltjp.com/en/directory/item/12624/
- **Notes:** Gion's teahouse street, running south from Shijo-dori between wood-latticed machiya to Kenninji. Come at dusk, when the lanterns come on and you may see a geiko or maiko on her way to an appointment; let her pass, since photographing maiko is bad manners here. The stone lanes off the street are private, with signs banning entry and photography, so keep to Hanamikoji itself, then cross Shijo to the quieter Shirakawa canal.
- **History:** Hanamikoji was laid out in the early Meiji era, and through the Meiji and Taisho periods Gion's teahouses gathered on its south side, which gave the street the look it still has. On the corner with Shijo stands Ichiriki-tei, the most prestigious of Gion's teahouses, which appears in the kabuki drama Chushingura. Its power lines went underground and its stone paving went down in 2001. At its south end stands the Gion Kobu Kaburenjo theatre, home of the Miyako Odori dances.
- Sources: gltjp.com directory 12624, kids.rurubu.jp article 839, travelvoice.jp 20240311-155262, japan-guide e3950_higashiyama_half and e3902.

### K4. Sanjusangen-do
- 34.988530, 135.772327 (North Gate, OSM way 466943459) · 京都府京都市東山区三十三間堂廻町657 · NEW Sanjusangendo · Temple · sozu
- 9:00–16:00 (last entry 15:30); open every day · `Apr 01-Nov 15 08:30-17:00; Nov 16-Mar 31 09:00-16:00` · official, verified
- ¥600 · No · https://www.sanjusangendo.jp/
- **Notes:** Inside a 120 m hall, Japan's longest wooden building, 1,001 life-size statues of the thousand-armed Kannon stand in ten rows around a great seated Kannon, with the wind and thunder gods and 28 guardians before them, all National Treasures. Shoes come off at the door, and 30 to 45 minutes is enough. It's at the Hakubutsukan Sanjusangendo-mae stop (bus 100, 206 or 208 from Kyoto Station) or 7 minutes from Keihan Shichijo.
- **History:** Retired Emperor Go-Shirakawa built the hall at his palace in 1164. It burned some 80 years later and was soon rebuilt by Retired Emperor Go-Saga; that Kamakura-era hall is the one standing today. Toyotomi Hideyoshi built his Great Buddha temple Hoko-ji next door and walled the hall into its grounds, and his South Gate and Taiko wall still stand. When all thousand standing Kannon were made National Treasures in 2018, the statues lent to museums came home, and all 1,001 stand together again.
- Sources: sanjusangendo.jp (visit, history, statue), japan-guide e3900.

### K5. Tofuku-ji
- 34.976513, 135.772880 (Nikkamon, the visitors' west gate, OSM way 770973993) · 京都府京都市東山区本町15-778 · NEW Tofukuji · Temple; Garden · sozu
- From Dec 7: 9:00–16:00 (to Dec 6: 8:30–16:30), last entry 30 min before · `Apr 01-Nov 13 09:00-16:30; Nov 14-Dec 06 08:30-16:30; Dec 07-Mar 31 09:00-16:00` · official, verified
- Grounds free; Tsutenkyo ¥600 and Hojo garden ¥600 from Dec 7, or ¥1,000 combined · No · https://tofukuji.jp/guide/tour/en/
- **Notes:** A great Zen temple whose roofed wooden Tsutenkyo bridge crosses a ravine of maples, one of Kyoto's best-known autumn views. Don't skip the Hojo garden, Shigemori Mirei's 1939 "Garden of Eight Views", with a different garden on each side of the abbot's hall. It's 10 minutes on foot from Tofukuji Station (JR Nara Line or Keihan), one stop from Inari, so pair it with Fushimi Inari the same morning.
- **History:** The regent Kujo Michiie built it from 1236 to 1255 as Kyoto's largest temple, taking the 東 of Todai-ji and the 福 of Kofuku-ji, Nara's greatest temples, for its name. Its founding abbot, Enni Ben'en, came home from six years in Song China with books, a design for a water-powered mill that started Japanese noodle-making, and the tea seeds behind Shizuoka tea. Fires in 1319, 1334 and 1336 took most of the temple, and another in 1881 burned the Buddha hall, but the medieval Sanmon gate survived: the oldest and largest of its kind, and a National Treasure.
- Sources: tofukuji.jp (guide, history, top, access, guide/tour/en), insidekyoto.com tofuku-ji.

### K6. Kinkaku-ji
- 35.039095, 135.730034 (Somon, OSM way 345428773) · 京都府京都市北区金閣寺町1 · Kinugasa · Temple; Garden · sozu
- 9:00–17:00, every day · `09:00-17:00` · official, verified
- ¥500 · No · https://www.shokoku-ji.jp/en/kinkakuji
- **Notes:** The Golden Pavilion: a three-storey hall over a large pond, its top two floors covered in gold leaf, each floor in a different style (palace, samurai house, Chinese Zen hall) with a golden phoenix on the roof. You see it across the water first, then the path loops behind it through the original garden, past the Sekkatei teahouse, to matcha and sweets by the exit; allow 15 to 45 minutes. Bus 205 runs direct from Kyoto Station in about 40 minutes; pair it with Ryoan-ji's rock garden next door.
- **History:** In the Kamakura period this was the villa of the courtier Saionji Kintsune, until the third Ashikaga shogun Yoshimitsu took it over and built his palace, Kitayama-dono, around a golden pavilion meant to evoke paradise on earth. After Yoshimitsu died in 1408 the villa became a Zen temple by his will, named Rokuon-ji after his posthumous name. In 1950 a young monk set the pavilion on fire, and the building you see is the 1955 rebuild, gold leaf and all. The temple bell by the gate is older than the pavilion: the Saionji family had it cast in the Kamakura period.
- Sources: shokoku-ji.jp kinkakuji (access, fee notice, en/about, en/guide, en/faq), japan-guide e3908.

### K7. Ryoan-ji
- 35.032935, 135.719354 (Sanmon, OSM way 374567317) · 京都府京都市右京区龍安寺御陵下町13 · Ryoanji · Temple; Garden · sozu
- 8:30–16:30 (Dec–Feb) · `Mar-Nov 08:00-17:00; Dec-Feb 08:30-16:30` · official, verified
- ¥600 · No · http://www.ryoanji.jp/smph/eng/index.html
- **Notes:** Japan's most famous rock garden: 15 stones in raked white gravel inside low earthen walls, set so that from anywhere on the veranda at least one is always hidden. Come at opening, when it's quiet enough to sit and puzzle over it, then circle the old pond below and have yudofu at Seigenin in the grounds. A JR bus runs direct from Kyoto Station in about 30 minutes, and Kinkaku-ji is a short hop away.
- **History:** Hosokawa Katsumoto, deputy to the Ashikaga shoguns, founded Ryoan-ji in 1450 on a nobleman's villa, inviting the Zen priest Giten Gensho to make it a temple. Twenty years later it burned in the Onin War, the very war Katsumoto led one side of, and his son Masamoto rebuilt it. The abbot's hall went up in 1499, the rock garden probably with it, and when fire took the hall again in 1797 the temple moved in the hall of its sub-temple Seigen-in, which still faces the garden today. Toyotomi Hideyoshi came here often, and Katsumoto is buried in the grounds.
- Sources: ryoanji.jp (smph index, eng/history, info_202608), japan-guide e3909.

### K8. Ginkaku-ji
- 35.027165, 135.797697 (Somon, OSM way 353574388) · 京都府京都市左京区銀閣寺町2 · NEW Ginkakuji · Temple; Garden · sozu
- 9:00–16:30 (Dec–Feb), every day · `Mar-Nov 08:30-17:00; Dec-Feb 09:00-16:30` · official, verified
- ¥1,000 · No · https://www.shokoku-ji.jp/en/ginkakuji
- **Notes:** The Silver Pavilion was never silvered; the draw is the quiet two-storey Kannon-den beside a pond, a moss garden, and the raked "Sea of Silver Sand" with its flat-topped sand cone. The path climbs the hillside behind for a view over the temple and the city; allow 15 to 45 minutes. Best reached on foot along the Philosopher's Path from Nanzen-ji, or by bus 5 or 17 from Kyoto Station.
- **History:** The eighth shogun, Ashikaga Yoshimasa, grandson of Kinkaku-ji's Yoshimitsu, began his retirement villa here in 1482, on the ashes of a temple burned in the Onin War, the war that grew out of his own quarrel over the succession. The pavilion's frame went up in 1489, but Yoshimasa died in 1490 before it was finished, and by his will the villa became a Zen temple. The arts he gathered here, from tea to flower arrangement to Noh, became the Higashiyama culture. The pavilion and the Togu-do are the only buildings left from his day, and the name "Silver Pavilion" only arrived in the Edo period, to pair it with the Golden one.
- Sources: shokoku-ji.jp ginkakuji (access, top, about, en/guide), japan-guide e3907.

### K9. Philosopher's Path
- 35.026921, 135.795346 (north end at Ginkakuji-bashi, OSM way 593317542) · ~京都府京都市左京区浄土寺上南田町 · NEW Ginkakuji · Walk · sozu
- Always open · `24/7` · third party
- Free · No · https://www.japan-guide.com/e/e3906.html
- **Notes:** A stone path of about 2 km along a canal under hundreds of cherry trees, from the Ginkaku-ji approach south to near Nanzen-ji. It's lined with cafés, small shops and quiet temples a short detour off it (Honen-in is the one to see), and walking it end to end takes 30 to 45 minutes. Walk it between Ginkaku-ji and Nanzen-ji to link the two temples.
- **History:** The path began as the maintenance track for a branch of the Lake Biwa Canal, built in the Meiji period to bring water and boats into Kyoto. Philosophers of the Kyoto School, above all Nishida Kitaro, walked it lost in thought, and it became the Philosopher's Path in 1969, while locals campaigned to save the canal. The cherry trees go back to 1922, when the painter Hashimoto Kansetsu, who lived nearby, and his wife planted saplings, and some still call them "Kansetsu's cherries".
- Sources: nippon.com gu003021, japan-guide e3906 and e3907, biwakososui.kyoto.travel midokoro 128.

### K10. Nanzen-ji
- 35.011290, 135.792597 (Sanmon, OSM way 190876301) · 京都府京都市左京区南禅寺福地町 · Nanzenji · Temple; Garden · sozu
- Sanmon and Hojo garden 8:40–16:30 (Dec–Feb), last entry 20 min before; closed Dec 28–31 · `Mar-Nov 08:40-17:00; Dec-Feb 08:40-16:30; Dec 28-31 off` · official, verified
- Grounds free; Sanmon ¥600, Hojo garden ¥600 · No · https://nanzenji.or.jp/
- **Notes:** One of Japan's great Zen head temples, with free grounds at the foot of the eastern hills. Climb the huge wooden Sanmon gate for its balcony view over the city, see the Hojo's rock garden of "tigers crossing water", then walk behind it to the Meiji-era red-brick aqueduct that carries the Lake Biwa Canal through the grounds. It's 10 minutes from Keage Station on the Tozai Line through a twisted brick tunnel; walk north up the Philosopher's Path to Ginkaku-ji after.
- **History:** In 1291 the retired Emperor Kameyama gave his villa to the Zen master Mukan Fumon. The story goes that strange happenings plagued the villa until Mukan and his monks moved in and simply kept to sitting, sweeping and chanting, and the hauntings stopped. The present 22 m Sanmon was rebuilt in 1628 by the warlord Todo Takatora to pray for his men killed at the siege of Osaka. Kabuki made it the hideout of the outlaw Ishikawa Goemon, and the 6 m stone lantern beside it is still called one of the largest in the East.
- Sources: nanzenji.or.jp (about_rinzaishu/visit, profile, about_rinzaishu/history, equipment/sanmon, equipment/sosui, information notices), japan-guide e3905.

### K11. Nijo Castle
- 35.012872, 135.751044 (East Gate, OSM way 99019130) · 京都府京都市中京区二条通堀川西入二条城町541 · Nijo · Castle; Garden · sozu
- 8:45–17:00, last entry 16:00; Ninomaru Palace closed Tuesdays in December and Dec 26–28; closed Dec 29–31 · `08:45-17:00; Dec 29-Dec 31 off` · official, verified
- ¥1,300 with the Ninomaru Palace; Honmaru Palace +¥1,000 by web ticket · No · https://nijo-jocastle.city.kyoto.lg.jp/?lang=en
- **Notes:** The shoguns' Kyoto palace, where you walk the Ninomaru Palace's corridors on nightingale floors that squeak underfoot as an alarm against intruders, past rooms of gold-leaf Kano School paintings. Nijojo-mae Station on the Tozai Line is steps from the East Gate. The Honmaru Palace costs ¥1,000 more and needs a web ticket, on sale 30 days ahead.
- **History:** Tokugawa Ieyasu, the first Edo shogun, built Nijo in 1603 as his Kyoto residence, and his grandson Iemitsu enlarged it for a visit by Emperor Go-Mizunoo in 1626, with Kano School painters decorating the new palaces. In October 1867 the last shogun, Tokugawa Yoshinobu, gathered the lords of 40 domains in the Ninomaru Palace's great hall and handed political power back to the Emperor, ending 260 years of shogun rule. The great hall where it happened is on the Ninomaru route today.
- Sources: nijo-jocastle.city.kyoto.lg.jp (top en/ja, access, admission/fee, introduction/highlights/history), japan-guide e3918.

### K12. To-ji
- 34.979560, 135.747702 (Nandaimon, OSM way 359935527) · 京都府京都市南区九条町1 · Toji · Temple · sozu
- Grounds 5:00–17:00; Kondo and Kodo 8:00–17:00, last entry 16:30 · `05:00-17:00` · official, verified
- Grounds free; Kondo and Kodo ¥800 · No · https://toji.or.jp/en/
- **Notes:** Japan's tallest wooden pagoda, 57 m and five storeys, rises over grounds that are free to wander; ¥800 lets you into the Kondo and the Kodo, where statues stand as a 3D Buddhist mandala around Dainichi Buddha. On the 21st of every month the Kobo-san market fills the grounds with close to 1,000 stalls of antiques, old kimono, pottery and food. It's a 15-minute walk from Kyoto Station's Hachijo exit.
- **History:** To-ji was founded with the new capital of Heian-kyo in 794, one of only two temples allowed inside the city, guarding its main gate. In 823 Emperor Saga gave it to the monk Kukai (Kobo Daishi), who made it the head seminary of Shingon Buddhism and added the lecture hall and the pagoda. The pagoda, lost to lightning, went back up in 1644. Today it's the only building complex left from the Heian capital, and the market still falls on the 21st because Kukai died on March 21.
- Sources: toji.or.jp (admission, en/location, history, en/about, mieku), japan-guide e3919, kyotostation.com toji-temple-kobo-ichi-market.

### K13. Byodo-in
- 34.890213, 135.807109 (main-gate ticket booth where the Omotesando ends, OSM way 332883359) · 京都府宇治市宇治蓮華116 · Uji · Temple; Garden · sozu
- Garden 8:45–17:30, last entry 17:15; Phoenix Hall tours 9:30–16:10 · `08:45-17:30` · official, verified
- ¥700; Phoenix Hall interior +¥300 · No · https://www.byodoin.or.jp/en/
- **Notes:** The Phoenix Hall, on every ¥10 coin, sits mirrored in its pond with a 2.4 m golden Amida Buddha inside. The interior is a separate ¥300 tour of up to 35 people every 20 minutes, sold at the garden reception, so buy one as soon as you arrive. Walk in along the Omotesando from Uji Bridge, lined with old Uji tea shops and matcha sweets; it makes a day with the Nintendo Museum.
- **History:** In 1052 the regent Fujiwara no Yorimichi turned his father Michinaga's riverside villa into a temple, in the year many believed the age of the Buddha's law had ended, and in 1053 he finished the Amida Hall to house Jocho's golden Amida, a vision of the Pure Land on earth. In 1336 fighting burned most of the temple, but the hall survived, and after a renovation in 1670 it came to be called the Phoenix Hall. Its image went onto the ¥10 coin in 1951.
- Sources: byodoin.or.jp (en/guide, en, guide/access, en/learn/history), gltjp.com directory 14605.

### K14. Arashiyama Bamboo Grove
- 35.017634, 135.674103 (east end, by Nonomiya Shrine, OSM way 105574212) · ~京都府京都市右京区嵯峨野々宮町 · Arashiyama · Walk · sozu
- Always open · `24/7` · third party
- Free · No · https://www.japan.travel/en/spot/1141/
- **Notes:** A short, flat path through towering bamboo that sways and creaks overhead, free and open all hours. Come in from Nonomiya Shrine or through Tenryu-ji's north gate and walk uphill to its top end at Okochi Sanso, whose garden is far quieter than the path. It's 10 minutes from JR Saga-Arashiyama Station.
- **History:** blank (decision 6).
- Sources: japan.travel spot 1141, japan-guide e3912.

### K15. Okochi Sanso
- 35.016542, 135.670234 (ticket office, OSM node 6875192885) · 京都府京都市右京区嵯峨小倉山田淵山町8 · Arashiyama · Garden · sozu
- 9:00–17:00, last entry 16:30 · `09:00-17:00` · third party (Sagano tourism company)
- ¥1,000 with matcha and a sweet · No · https://www.sagano-kanko.co.jp/en/spot/240
- **Notes:** A silent-film star's hillside villa at the top of the bamboo grove, with strolling paths that open onto views of Mount Hiei, the Hozu gorge and all of Kyoto. The ticket includes a bowl of matcha and a sweet in the tea house. It's the calm end of the bamboo walk, much quieter than the path below; the buildings are seen from outside.
- **History:** Okochi Denjiro, a samurai-film star of the 1930s, began building this villa in 1931, starting with a private Buddhist hall where he meditated between shoots. He poured his film earnings into it for the next 30 years, shaping the hillside into gardens around his main house, the Daijokaku, until he died here in 1962. The Daijokaku and the moss-garden tea house are on the walk.
- Sources: sagano-kanko.co.jp spot 240, intojapanwaraku.com 20170222/9148, japan-guide e3912, japan.travel spot 1141.
