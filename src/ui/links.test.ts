import { describe, expect, it } from "vitest";
import { copyText, directionsUrl, linkLabel, parseSharedLink, shareText, shareUrl } from "./links.ts";

const HOST = "japan.garbage.house";

describe("directionsUrl", () => {
  it("uses coordinates and transit mode", () => {
    expect(directionsUrl({ lat: 35.6937428, lng: 139.7613047 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=35.693743%2C139.761305&travelmode=transit",
    );
  });
});

describe("copyText", () => {
  it("name and address on two lines, or the name alone", () => {
    expect(copyText({ name: "Glitch", address: "東京都千代田区神田錦町3-16" })).toBe("Glitch\n東京都千代田区神田錦町3-16");
    expect(copyText({ name: "Glitch", address: undefined })).toBe("Glitch");
  });
});

describe("shareUrl / shareText", () => {
  it("links to region and id only", () => {
    const url = shareUrl({ id: "tokyo-coffee:bear-pond-espresso", region: "tokyo" }, "https://japan.garbage.house");
    expect(url).toBe("https://japan.garbage.house/?r=tokyo&s=tokyo-coffee%3Abear-pond-espresso");
    expect(shareText({ name: "Bear Pond Espresso" }, url)).toBe(`Bear Pond Espresso\n${url}`);
  });
});

describe("linkLabel", () => {
  it("tells Instagram from everything else", () => {
    expect(linkLabel("https://www.instagram.com/glitchcoffee/")).toBe("Instagram");
    expect(linkLabel("https://instagram.com/x")).toBe("Instagram");
    expect(linkLabel("https://glitchcoffee.com")).toBe("Website");
    expect(linkLabel("not a url")).toBe("Website");
  });
});

describe("parseSharedLink", () => {
  const id = "tokyo-coffee:bear-pond-espresso";

  it("reads a full link to this site", () => {
    expect(parseSharedLink(`https://${HOST}/?r=tokyo&s=tokyo-coffee%3Abear-pond-espresso`, HOST)).toBe(id);
    expect(parseSharedLink(`${HOST}/?s=${id}`, HOST)).toBe(id);
    expect(parseSharedLink(`  https://${HOST}/?s=${id}&q=x  `, HOST)).toBe(id);
  });

  it("accepts a bare place id", () => {
    expect(parseSharedLink(id, HOST)).toBe(id);
    expect(parseSharedLink("kyoto-food:some-place", HOST)).toBe("kyoto-food:some-place");
  });

  it("ignores ordinary search text, other sites, and links without a place", () => {
    expect(parseSharedLink("glitch", HOST)).toBeUndefined();
    expect(parseSharedLink("bear pond", HOST)).toBeUndefined();
    expect(parseSharedLink("https://example.com/?s=" + id, HOST)).toBeUndefined();
    expect(parseSharedLink(`https://${HOST}/?r=tokyo`, HOST)).toBeUndefined();
    expect(parseSharedLink("", HOST)).toBeUndefined();
    expect(parseSharedLink("Mo-Fr 08:00-19:00", HOST)).toBeUndefined();
  });
});
