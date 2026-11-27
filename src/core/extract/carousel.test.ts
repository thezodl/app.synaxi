import { describe, expect, it } from "bun:test";

import { groupCarousels } from "./carousel";

const img = (n: number) => `<img src="https://x.example/${n}.jpg" alt="${n}">`;
const count = (html: string) => (html.match(/class="carousel"/g) ?? []).length;

describe("groupCarousels", () => {
  it("leaves two images inline", () => {
    const html = `<p>Intro</p>${img(1)}${img(2)}<p>After</p>`;
    expect(groupCarousels(html)).toBe(html);
  });

  it("groups three consecutive images, keeping surrounding text", () => {
    const out = groupCarousels(`<p>Intro</p>${img(1)}\n${img(2)} ${img(3)}<p>After</p>`);
    expect(count(out)).toBe(1);
    expect(out).toContain('data-count="3"');
    expect(out.indexOf("Intro")).toBeLessThan(out.indexOf("carousel"));
    expect(out.indexOf("carousel")).toBeLessThan(out.indexOf("After"));
  });

  it("text between images breaks the run", () => {
    const out = groupCarousels(`${img(1)}${img(2)}<p>Words</p>${img(3)}${img(4)}`);
    expect(count(out)).toBe(0);
  });

  it("groups images inside a single paragraph and across <br>", () => {
    expect(count(groupCarousels(`<p>${img(1)}<br>${img(2)}<br>${img(3)}</p>`))).toBe(1);
  });

  it("groups gallery figures and keeps captions", () => {
    const figs = [1, 2, 3, 4]
      .map((n) => `<figure>${img(n)}<figcaption>Cap ${n}</figcaption></figure>`)
      .join("");
    const out = groupCarousels(`<div>${figs}</div>`);
    expect(count(out)).toBe(1);
    expect(out).toContain('data-count="4"');
    expect(out).toContain("<figcaption>Cap 4</figcaption>");
  });

  it("finds runs nested inside other blocks", () => {
    expect(
      count(groupCarousels(`<blockquote><p>Q</p>${img(1)}${img(2)}${img(3)}</blockquote>`)),
    ).toBe(1);
  });

  it("never groups video posters", () => {
    const video = `<figure class="video" data-embed="https://www.youtube-nocookie.com/embed/x"><img src="https://i.ytimg.com/vi/x/hqdefault.jpg"></figure>`;
    expect(count(groupCarousels(`${video}${img(1)}${img(2)}`))).toBe(0);
  });

  it("is a no-op without images", () => {
    expect(groupCarousels("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});
