import { describe, expect, it } from "vitest";
import { locales } from "./i18n";
import { seoGuide } from "./seoGuide";

describe("localized SEO Guide", () => {
  it("provides a complete guide for every supported locale", () => {
    for (const locale of locales) {
      const copy = seoGuide[locale];
      expect(copy.eyebrow.length).toBeGreaterThan(2);
      expect(copy.title.length).toBeGreaterThan(8);
      expect(copy.intro.length).toBeGreaterThan(40);
      expect(copy.directBody.length).toBeGreaterThan(70);
      expect(copy.stepsBody.length).toBeGreaterThan(70);
      expect(copy.privacyBody.length).toBeGreaterThan(30);
      expect(copy.keywords.length).toBeGreaterThan(20);
    }
  });

  it("does not fall back to a single English article", () => {
    const titles = new Set(locales.map(locale => seoGuide[locale].title));
    expect(titles.size).toBe(locales.length);
    expect(seoGuide.tr.directHeading).toContain("Wi‑Fi");
    expect(seoGuide.ja.directHeading).toContain("Wi‑Fi");
    expect(seoGuide.ar.privacyHeading).not.toBe(seoGuide.en.privacyHeading);
  });
});
