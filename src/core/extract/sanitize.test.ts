import { describe, expect, it } from "bun:test";
import { bestFromSrcset, parseVideoEmbed } from "./media";
import { sanitizeArticleHtml } from "./sanitize";

const BASE = "https://site.example/posts/hello";

describe("sanitizeArticleHtml", () => {
  it("strips scripts, styles, forms, handlers and classes", () => {
    const { html } = sanitizeArticleHtml(
      `<div class="x" style="color:red" onclick="evil()"><p id="a">Hi <script>alert(1)</script><b>there</b></p>
       <form><input></form><style>p{}</style><span>inline</span></div>`,
      BASE,
    );
    expect(html).not.toMatch(/script|onclick|style|class=|<form|<input|id="a"/);
    expect(html).toContain("<p>Hi <b>there</b></p>");
    expect(html).toContain("inline");
    expect(html).not.toContain("<span");
  });

  it("resolves relative and lazy images in place, collecting them in order", () => {
    const { html, images } = sanitizeArticleHtml(
      `<p>one</p><img src="data:image/gif;base64,R0" data-src="/a.jpg"><p>two</p>
       <img srcset="b-400.jpg 400w, b-1200.jpg 1200w, b-3000.jpg 3000w" src="b-400.jpg">
       <img src="https://t.example/pixel.gif" width="1" height="1">`,
      BASE,
    );
    expect(images).toEqual(["https://site.example/a.jpg", "https://site.example/posts/b-400.jpg"]);
    expect(html.indexOf("a.jpg")).toBeLessThan(html.indexOf("two"));
    expect(html).not.toContain("pixel.gif");
  });

  it("collapses <picture> to its img, preferring a source srcset over a placeholder", () => {
    const { images } = sanitizeArticleHtml(
      `<picture><source srcset="/p-800.webp 800w, /p-1600.webp 1600w"><img src="data:image/gif;base64,R0" alt="p"></picture>`,
      BASE,
    );
    expect(images).toEqual(["https://site.example/p-1600.webp"]);
  });

  it("turns YouTube iframes into poster figures and drops other iframes", () => {
    const { html, images } = sanitizeArticleHtml(
      `<p>Watch:</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=x"></iframe><iframe src="https://ads.example/x"></iframe>`,
      BASE,
    );
    expect(html).toContain('class="video"');
    expect(html).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(html).not.toContain("ads.example");
    expect(images).toEqual(["https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"]);
  });

  it("demotes h1, absolutises links and removes javascript: hrefs", () => {
    const { html } = sanitizeArticleHtml(
      `<h1>T</h1><a href="../x">x</a><a href="javascript:alert(1)">y</a>`,
      BASE,
    );
    expect(html).toContain("<h2>T</h2>");
    expect(html).toContain('href="https://site.example/x"');
    expect(html).not.toContain("javascript");
  });

  it("removes empty wrappers left behind", () => {
    const { html } = sanitizeArticleHtml(`<div><div> </div></div><p></p><p>kept</p>`, BASE);
    expect(html).toBe("<p>kept</p>");
  });
});

describe("media helpers", () => {
  it("parses YouTube and Vimeo URLs", () => {
    expect(parseVideoEmbed("https://youtu.be/abcdefghijk")?.id).toBe("abcdefghijk");
    expect(parseVideoEmbed("https://www.youtube-nocookie.com/embed/abcdefghijk")?.provider).toBe(
      "youtube",
    );
    expect(parseVideoEmbed("https://player.vimeo.com/video/12345")).toMatchObject({
      provider: "vimeo",
      id: "12345",
      posterUrl: null,
    });
    expect(parseVideoEmbed("https://example.com/embed/x")).toBeNull();
  });

  it("picks the widest srcset candidate within the cap", () => {
    expect(bestFromSrcset("a.jpg 400w, b.jpg 1200w, c.jpg 3000w")).toBe("b.jpg");
    expect(bestFromSrcset("a.jpg 1x, b.jpg 2x")).toBe("b.jpg");
    expect(bestFromSrcset("c.jpg 3000w")).toBe("c.jpg");
  });
});
