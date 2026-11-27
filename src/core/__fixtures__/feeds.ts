const long = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

export const RSS_FULL = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Example &amp; Co</title>
  <link>https://example.com/</link>
  <item>
    <title>First &lt;em&gt;post&lt;/em&gt;</title>
    <link>https://example.com/first</link>
    <guid isPermaLink="false">abc-123</guid>
    <pubDate>Sat, 14 Nov 2026 09:30:00 +0000</pubDate>
    <dc:creator>Jo Author</dc:creator>
    <description>Short summary</description>
    <content:encoded><![CDATA[<p>${long(300)}</p><img src="/img/a.jpg">]]></content:encoded>
    <media:thumbnail url="https://cdn.example.com/thumb.jpg"/>
  </item>
  <item>
    <title>No guid</title>
    <link>https://example.com/second</link>
    <description><![CDATA[<p>Teaser only. <a href="https://example.com/second">Read more</a></p><img src="https://example.com/b.png">]]></description>
  </item>
</channel></rss>`;

export const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Atom Blog</title>
  <link rel="self" href="https://atom.example/feed.xml"/>
  <link rel="alternate" type="text/html" href="https://atom.example/"/>
  <entry>
    <title>Atom entry</title>
    <id>tag:atom.example,2026:1</id>
    <link rel="alternate" type="text/html" href="/posts/1"/>
    <published>2026-11-13T12:00:00Z</published>
    <updated>2026-11-13T13:00:00Z</updated>
    <author><name>Ada</name></author>
    <content type="html">&lt;p&gt;Hello &lt;img src="pic.jpg"&gt;&lt;/p&gt;</content>
  </entry>
</feed>`;

export const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>RDF Feed</title><link>https://rdf.example/</link></channel>
  <item rdf:about="https://rdf.example/1">
    <title>RDF item</title>
    <link>https://rdf.example/1</link>
    <dc:date>2026-11-12T08:00:00Z</dc:date>
    <description>Body</description>
  </item>
</rdf:RDF>`;

export const FEEDLY_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Zac subscriptions in feedly Cloud</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="The Verge" title="The Verge" xmlUrl="https://www.theverge.com/rss/index.xml" htmlUrl="https://www.theverge.com"/>
      <outline text="Nested" title="Nested">
        <outline type="rss" text="Deep" title="Deep" xmlUrl="https://deep.example/feed"/>
      </outline>
    </outline>
    <outline text="Private" title="Private">
      <outline type="rss" text="Secret" title="Secret" xmlUrl="https://priv.example/feed?key=s3cret" htmlUrl="https://priv.example"/>
      <outline type="rss" text="The Verge again" title="The Verge again" xmlUrl="https://www.theverge.com/rss/index.xml"/>
    </outline>
    <outline type="rss" text="Loose" title="Loose" xmlUrl="https://loose.example/rss"/>
  </body>
</opml>`;

export const LONG_TEXT = long;

export const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Some Channel</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UC123"/>
  <entry>
    <id>yt:video:abcdefghijk</id>
    <yt:videoId>abcdefghijk</yt:videoId>
    <title>A video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/>
    <published>2026-11-11T18:43:56+00:00</published>
    <media:group>
      <media:title>A video</media:title>
      <media:thumbnail url="https://i2.ytimg.com/vi/abcdefghijk/hqdefault.jpg" width="480" height="360"/>
      <media:description>Line one &lt;b&gt;
Line two

Second paragraph</media:description>
    </media:group>
  </entry>
</feed>`;
