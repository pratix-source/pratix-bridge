import { describe, expect, it } from "vitest";
import { dictionaries, locales, translate } from "./i18n";

describe("Pratix Bridge locales", () => {
  it("ships the required twelve language dictionaries", () => {
    expect(locales).toHaveLength(12);
    locales.forEach(locale => {
      expect(dictionaries[locale].heroTitle).toBeTruthy();
      expect(dictionaries[locale].send).toBeTruthy();
      expect(translate(locale, "installTitle")).toBeTruthy();
      expect(translate(locale, "privacy")).toBeTruthy();
    });
  });

  it("keeps English as the default vocabulary", () => {
    expect(translate("en", "createBridge")).toBe("Create a bridge");
    expect(translate("en", "browserToBrowser")).toBe("Browser-to-browser transfer");
  });
});
