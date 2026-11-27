import { describe, expect, it } from "bun:test";
import { sanitizeArticleHtml } from "./sanitize";

const BASE = "https://site.example/2026/11/story";
const clean = (html: string) => sanitizeArticleHtml(html, BASE);

describe("boilerplate removal", () => {
  it("drops the affiliate disclosure, Google preferred-source badges and banner ads", () => {
    const { html, images } = clean(
      `<p>Real ending of the article, which is long enough to be prose.</p>
       <p><a href="https://google.com/preferences/source?q=site.example"><img src="https://cdn.example/pref-light.png" alt="Add as a preferred source on Google"></a></p>
       <p><a href="https://www.google.com/preferences/source?q=site.example"><img src="https://cdn.example/pref-dark.png"></a></p>
       <p><em>FTC: We use income earning auto affiliate links.</em> <a href="/about/#affiliate">More.</a></p>
       <p><a href="https://shop.example/deal?utm_source=site&utm_medium=banner"><img src="https://cdn.example/black-friday.jpg"></a></p>`,
    );
    expect(html).toContain("Real ending");
    expect(html).not.toMatch(/FTC|preferences\/source|pref-|black-friday/);
    expect(images).toEqual([]);
  });

  it('drops a "More on X:" heading and its list of links', () => {
    const { html } = clean(
      `<p>Body text.</p>
       <h2>More on Samsung:</h2>
       <ul><li><a href="/a">Story A</a></li><li><a href="/b">Story B</a></li></ul>
       <p><strong>Related:</strong> <a href="/c">Story C</a></p>
       <p><strong>Read more:</strong></p><ul><li><a href="/d">Story D</a></li></ul>`,
    );
    expect(html).toBe("<p>Body text.</p>");
  });

  it("drops author social lines and community promos", () => {
    const { html } = clean(
      `<p>Body text.</p>
       <p><em><strong>Follow Ben</strong>: <a href="https://x.com/b">Twitter/X</a>, <a href="https://threads.net/b">Threads</a>, and <a href="https://instagram.com/b">Instagram</a></em></p>
       <p><a href="https://www.reddit.com/r/SiteCommunity/"><img src="https://cdn.example/reddit.png" alt="Click to join us on r/SiteCommunity"></a></p>
       <p><em>Join us on <a href="https://www.reddit.com/r/SiteCommunity/">Reddit at r/SiteCommunity</a> to share your insights.</em></p>`,
    );
    expect(html).toBe("<p>Body text.</p>");
  });

  it("keeps ordinary content that only looks similar", () => {
    const src = `<p>Follow the instructions below: open Settings, then tap About phone.</p>
       <h2>More on that later</h2><p>Some prose under the heading.</p>
       <ul><li><a href="/spec">Spec sheet</a></li></ul>
       <p><a href="https://site.example/full.jpg"><img src="https://site.example/thumb.jpg"></a></p>
       <p>FTC filings show the company disclosed the deal in a long paragraph about regulation, not a disclaimer.</p>`;
    const { html, images } = clean(src);
    expect(html).toContain("Follow the instructions");
    expect(html).toContain("More on that later");
    expect(html).toContain("Spec sheet");
    expect(html).toContain("FTC filings");
    expect(images).toEqual(["https://site.example/thumb.jpg"]);
  });

  it("leaves social embeds alone", () => {
    const embeds = [
      `<blockquote class="twitter-tweet"><p lang="en">Follow the link: <a href="https://t.co/abc">t.co/abc</a></p>&mdash; Some Person (@someone) <a href="https://twitter.com/someone/status/123?ref_src=twsrc%5Etfw">November 20, 2026</a></blockquote>`,
      `<blockquote class="instagram-media"><a href="https://www.instagram.com/p/XYZ/?utm_source=ig_embed"><img src="https://site.example/ig.jpg"></a><p><a href="https://www.instagram.com/p/XYZ/">A post shared by Someone (@someone)</a></p></blockquote>`,
      `<blockquote class="reddit-embed-bq"><a href="https://www.reddit.com/r/Android/comments/abc/title/">Post title</a><br> by <a href="https://www.reddit.com/user/u/">u/someone</a> in <a href="https://www.reddit.com/r/Android/">Android</a></blockquote>`,
      `<blockquote class="bluesky-embed"><p>Join us on stage tonight for the launch.</p>&mdash; Someone (<a href="https://bsky.app/profile/x">@x.bsky.social</a>) <a href="https://bsky.app/profile/x/post/1">Nov 20, 2026</a></blockquote>`,
    ];
    for (const e of embeds) {
      const { html } = clean(`<p>Body text.</p>${e}`);
      expect(html).toContain("<blockquote>");
    }
    expect(clean(`<p>x</p>${embeds[0]}`).html).toContain("Follow the link");
    expect(clean(`<p>x</p>${embeds[1]}`).images).toEqual(["https://site.example/ig.jpg"]);
    expect(clean(`<p>x</p>${embeds[2]}`).html).toContain("Post title");
    expect(clean(`<p>x</p>${embeds[3]}`).html).toContain("Join us on stage");
  });

  it("drops leftover byline widgets, datelines, headshots and the author bio", () => {
    const { html, images } = sanitizeArticleHtml(
      `<div><p>Follow</p><p>Link copied to clipboard</p>
       <img src="https://cdn.site.example/authors/brian.jpg" alt="">
       <p>Published Nov 22, 2026, 4:00 AM EST</p>
       <p>By Brian VanHooker</p>
       <p>Brian VanHooker is a Pop Culture Writer specializing in oral histories. He was the Senior Features Writer at Cracked.</p></div>
       <p>D'oh!</p><img src="https://cdn.site.example/2026/11/homer.jpg" alt="Homer">`,
      BASE,
      { author: "Brian VanHooker" },
    );
    expect(html).toBe(
      `<p>D'oh!</p><img src="https://cdn.site.example/2026/11/homer.jpg" alt="Homer">`,
    );
    expect(images).toEqual(["https://cdn.site.example/2026/11/homer.jpg"]);
  });

  it("keeps look-alikes of byline junk", () => {
    const { html } = sanitizeArticleHtml(
      `<p>Published in 1998, the book sold a million copies.</p>
       <p>Follow the money.</p>
       <p>Marge Simpson is a fictional character, and Brian is a common name.</p>
       <h2>By the numbers</h2>
       <img src="https://cdn.site.example/2026/11/marge.jpg" alt="Marge Simpson">`,
      BASE,
      { author: "Brian VanHooker" },
    );
    expect(html).toContain("Published in 1998");
    expect(html).toContain("Follow the money.");
    expect(html).toContain("Marge Simpson is");
    expect(html).toContain("By the numbers");
    expect(html).toContain("marge.jpg");
  });
});
