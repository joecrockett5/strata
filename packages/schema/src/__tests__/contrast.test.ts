import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, themeContrast } from "../contrast";
import type { Theme } from "../types";

interface Vector {
  foreground: string;
  background: string;
  ratio: number;
  passesAA: boolean;
}

const { vectors } = JSON.parse(
  readFileSync(new URL("../../../../fixtures/contrast.json", import.meta.url), "utf8"),
) as { vectors: Vector[] };

describe("contrast", () => {
  it.each(vectors)(
    "$foreground on $background is $ratio:1",
    ({ foreground, background, ratio, passesAA }) => {
      const actual = contrastRatio(foreground, background);
      expect(actual).toBeCloseTo(ratio, 2);
      expect(actual >= 4.5).toBe(passesAA);
      expect(contrastRatio(background, foreground)).toBeCloseTo(actual, 10);
    },
  );

  it("checks text/background and onPrimary/primary", () => {
    const theme: Theme = {
      colors: {
        primary: "#c9822b",
        onPrimary: "#ffffff",
        secondary: "#000000",
        accent: "#000000",
        background: "#ffffff",
        surface: "#ffffff",
        text: "#000000",
        mutedText: "#000000",
      },
      fonts: { heading: "system-ui", body: "system-ui" },
      radius: "none",
    };
    expect(themeContrast(theme).map((c) => [c.pair.join("/"), c.passes])).toEqual([
      ["text/background", true],
      ["onPrimary/primary", false],
    ]);
  });

  it("rejects malformed colours", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow();
  });
});
