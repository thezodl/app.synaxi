import { describe, expect, it } from "bun:test";
import { SAMPLE_PAGE_HTML, SAMPLE_PAGE_URL } from "../__fixtures__/sample-article";
import { extractArticle } from "./readability";

describe("extractArticle", () => {
  const result = extractArticle(SAMPLE_PAGE_HTML, SAMPLE_PAGE_URL);

  it("finds the article", () => {
    expect(result).not.toBeNull();
    expect(result!.title).toContain("folding phones");
    expect(result!.content).toContain("List-detail layouts are the clearest win");
  });

  it("strips site chrome", () => {
    expect(result!.content).not.toContain("Join newsletter");
    expect(result!.content).not.toContain("Trending");
  });

  it("resolves relative image URLs against the page URL", () => {
    expect(result!.content).toContain("https://example.com/images/fold-open.jpg");
  });
});
