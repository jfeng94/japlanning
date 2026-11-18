import { describe, expect, it } from "vitest";
import { addressesMatch, addressNumbers, namesMatch } from "./build-place-ids.ts";

describe("namesMatch", () => {
  it("ignores case, spacing and full-width letters", () => {
    expect(namesMatch("Covert Coffee", "COVERT COFFEE")).toBe(true);
    expect(namesMatch("lyf", "lyf Ginza Tokyo")).toBe(true);
    expect(namesMatch("Ｆｕｇｌｅｎ", "Fuglen Tokyo")).toBe(true);
  });

  it("lets generic words go unmatched, but not the brand", () => {
    expect(namesMatch("Wayfarer Hotel", "WAYFARER Kyoto Shijo")).toBe(true);
    expect(namesMatch("Bear Pond Espresso", "Bear Pond")).toBe(true);
    expect(namesMatch("Covert Coffee", "Glitch Coffee")).toBe(false);
    expect(namesMatch("Himitsudo", "Himitsudō")).toBe(true);
    expect(namesMatch("Tomiz (Tomizawa Shoten)", "Tomizawa Shouten Jiyugaoka Store")).toBe(true);
    expect(namesMatch("Kameido Gyoza Honten", "Kameido Gyoza Main Store")).toBe(true);
    expect(namesMatch("Yaesu Unagi Hashimoto", "Yaesu Hashimoto")).toBe(true);
    expect(namesMatch("Baji Tofu", "Oni-tofu")).toBe(false);
    expect(namesMatch("Utsuwa Haku", "Utsuwaya Saisai")).toBe(false);
    expect(namesMatch("Tori Kago", "鳥かご")).toBe(false);
    expect(namesMatch("Kyoto Narita", "Koyamakitakamifusacho")).toBe(false);
    expect(namesMatch("Coffee", "")).toBe(false);
  });
});

describe("addressNumbers", () => {
  it("reads ours and Google's the same way, without postal codes or floors", () => {
    expect(addressNumbers("東京都新宿区新宿3-27-10 武蔵野ビルB1F")).toEqual([3, 27, 10]);
    expect(addressNumbers("〒160-0022 Tokyo, Shinjuku City, Shinjuku, 3-chōme−27−１０ Musashino Building, B1F")).toEqual([3, 27, 10]);
    expect(addressNumbers("232 7th Ave, New York, NY 10011")).toEqual([232, 7, 10011]);
  });
});

describe("addressesMatch", () => {
  it("wants our first two numbers in a row", () => {
    expect(addressesMatch("東京都新宿区新宿3-27-10 武蔵野ビルB1F", "〒160-0022 Tokyo, Shinjuku City, Shinjuku, 3-chōme−27−１０ Musashino Building, B1F")).toBe(true);
    expect(addressesMatch("東京都新宿区新宿3-27-10", "Shinjuku, 3-chōme−27")).toBe(true);
    expect(addressesMatch("東京都新宿区新宿3-27-10", "〒160-0022 Tokyo, Shinjuku City, Shinjuku, 3-chōme−17−７ 紀伊國屋ビル B1F")).toBe(false);
    expect(addressesMatch("京都府京都市下京区本柳水町768", "768 Honryūsuichō, Shimogyo Ward, Kyoto, 600-8462")).toBe(true);
    expect(addressesMatch("232 7th Ave, New York, NY 10011", "232 7th Ave, New York, NY 10011, USA")).toBe(true);
  });
});
