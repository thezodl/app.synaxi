/** A small, realistic page with chrome around the article, used by tests. */
export const SAMPLE_PAGE_URL = "https://example.com/blog/2026/folding-phones";

export const SAMPLE_PAGE_HTML = `<!doctype html>
<html><head><title>Why folding phones finally make sense | Example Blog</title></head>
<body>
  <header><nav><a href="/">Home</a> <a href="/about">About</a> <a href="/subscribe">Subscribe!</a></nav></header>
  <aside class="sidebar"><h3>Trending</h3><ul><li><a href="/x">Other post</a></li></ul></aside>
  <main>
    <article>
      <h1>Why folding phones finally make sense</h1>
      <p class="byline">By Sam Writer</p>
      <p>For years folding phones were a curiosity: expensive, fragile and awkward. That has changed, and the
      reasons are more interesting than thinner hinges. Software finally treats the inner display as a first-class
      canvas rather than a stretched phone screen.</p>
      <figure><img src="/images/fold-open.jpg" alt="An unfolded phone"><figcaption>The inner display.</figcaption></figure>
      <p>List-detail layouts are the clearest win. On the cover screen you see a list; open the phone and the
      selected item appears beside it, with no loss of context. Reading apps benefit most of all, because long
      text is comfortable at tablet widths while navigation stays one tap away.</p>
      <p>Battery life, the other historic weakness, has improved through better panels and smarter refresh rates.
      Most owners now report a full day of mixed use, which removes the last practical objection for many people.</p>
    </article>
  </main>
  <footer><p>&copy; Example Blog</p><form><input placeholder="Email"><button>Join newsletter</button></form></footer>
</body></html>`;
