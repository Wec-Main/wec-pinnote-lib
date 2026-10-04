import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AiMarkdown,
  parseMarkdownBlocks,
  parseMarkdownSegments,
  safeHref,
  type MarkdownSegment,
} from "../src/features/ai/components/AiMarkdown";

const render = (text: string) => renderToStaticMarkup(createElement(AiMarkdown, { text }));

describe("AiMarkdown", () => {
  it("escapes raw HTML instead of rendering it", () => {
    const html = render('Hello <script>alert("x")</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("escapes HTML inside code, bold and links", () => {
    const html = render("`<b>x</b>` **<i>y</i>** [<u>z</u>](https://example.com)");
    expect(html).toContain('<code class="wpn-ai-md__code">&lt;b&gt;x&lt;/b&gt;</code>');
    expect(html).toContain("<strong>&lt;i&gt;y&lt;/i&gt;</strong>");
    expect(html).not.toContain("<u>");
  });

  it("only links http(s) / mailto URLs, with rel=noopener", () => {
    const html = render(
      "[ok](https://example.com/a) [bad](javascript:alert(1)) [data](data:text/html,hi)",
    );
    expect(html).toContain(
      '<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">ok</a>',
    );
    expect(html).not.toContain('javascript:alert(1)"');
    expect(html).not.toContain('href="javascript');
    expect(html).not.toContain('href="data');
    expect(safeHref(" mailto:a@b.c ")).toBe("mailto:a@b.c");
    expect(safeHref("JaVaScRiPt:x")).toBeNull();
  });

  it("renders paragraphs, lists, fences, bold and italic", () => {
    const html = render(
      "# Plan\n\nFirst *step* and **bold**\nsecond line\n\n- one\n- two\n\n1. a\n2. b\n\n```ts\nconst a = 1 < 2;\n```",
    );
    expect(html).toContain('<h1 class="wpn-ai-md__heading wpn-ai-md__heading--1">Plan</h1>');
    expect(html).toContain("<em>step</em>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<br/>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>a</li><li>b</li></ol>");
    expect(html).toContain(
      '<pre class="wpn-ai-md__pre" data-lang="ts"><code>const a = 1 &lt; 2;</code></pre>',
    );
  });

  it("keeps an unterminated fence as code (streaming)", () => {
    expect(parseMarkdownBlocks("text\n```\npartial")).toEqual([
      { kind: "paragraph", text: "text" },
      { kind: "code", lang: "", text: "partial" },
    ]);
  });

  it("renders h1-h4 and caps deeper headings at h4", () => {
    const html = render("## Two\n\n#### Four\n\n###### Six");
    expect(html).toContain('<h2 class="wpn-ai-md__heading wpn-ai-md__heading--2">Two</h2>');
    expect(html).toContain('<h4 class="wpn-ai-md__heading wpn-ai-md__heading--4">Four</h4>');
    expect(html).toContain('<h4 class="wpn-ai-md__heading wpn-ai-md__heading--4">Six</h4>');
  });

  it("renders GFM pipe tables with alignment and inline markdown", () => {
    const html = render(
      "| Entity | Fields | Note |\n| :--- | ---: | :---: |\n| `orders` | 12 | **pk** a\\|b |\n| users | 3 |",
    );
    expect(html).toContain('<table class="wpn-ai-md__table">');
    expect(html).toContain('<th style="text-align:left">Entity</th>');
    expect(html).toContain('<th style="text-align:right">Fields</th>');
    expect(html).toContain('<th style="text-align:center">Note</th>');
    expect(html).toContain(
      '<td style="text-align:left"><code class="wpn-ai-md__code">orders</code></td>',
    );
    expect(html).toContain("<strong>pk</strong> a|b");
    expect(html).toMatch(/users<\/td><td[^>]*>3<\/td><td[^>]*><\/td>/);
  });

  it("does not treat a lone pipe line as a table", () => {
    expect(parseMarkdownBlocks("a | b\nplain")).toEqual([
      { kind: "paragraph", text: "a | b\nplain" },
    ]);
  });

  it("nests lists by indentation", () => {
    const blocks = parseMarkdownBlocks("- a\n  - a1\n  - a2\n    1. deep\n- b\n\n3. c\n4. d");
    expect(blocks).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [
          {
            text: "a",
            children: [
              {
                kind: "list",
                ordered: false,
                items: [
                  { text: "a1", children: [] },
                  {
                    text: "a2",
                    children: [
                      { kind: "list", ordered: true, items: [{ text: "deep", children: [] }] },
                    ],
                  },
                ],
              },
            ],
          },
          { text: "b", children: [] },
        ],
      },
      {
        kind: "list",
        ordered: true,
        start: 3,
        items: [
          { text: "c", children: [] },
          { text: "d", children: [] },
        ],
      },
    ]);
    expect(render("- a\n  - a1")).toContain("<ul><li>a<ul><li>a1</li></ul></li></ul>");
    expect(render("3. c")).toContain('<ol start="3"><li>c</li></ol>');
  });

  it("renders blockquotes, rules and strikethrough", () => {
    const html = render("> quoted **bold**\n> - item\n\n---\n\n~~gone~~ text");
    expect(html).toContain(
      '<blockquote class="wpn-ai-md__quote"><p>quoted <strong>bold</strong></p><ul><li>item</li></ul></blockquote>',
    );
    expect(html).toContain('<hr class="wpn-ai-md__hr"/>');
    expect(html).toContain("<del>gone</del> text");
  });

  it("autolinks only safe URLs", () => {
    const html = render("See https://example.com/a?b=1. Or <mailto:x@y.z> and javascript:alert(1)");
    expect(html).toContain(
      '<a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1</a>.',
    );
    expect(html).toContain('href="mailto:x@y.z"');
    expect(html).not.toContain('href="javascript');
  });

  it("labels code blocks and offers Copy", () => {
    const html = render("```sql\nselect 1;\n```\n\n```\nplain\n```");
    expect(html).toContain('<span class="wpn-ai-md__lang">sql</span>');
    expect(html).toContain('aria-label="Copy code"');
    expect(html).toContain('<span class="wpn-ai-md__lang">code</span>');
  });

  it("marks streaming output for the cursor", () => {
    expect(
      renderToStaticMarkup(createElement(AiMarkdown, { text: "hi", streaming: true })),
    ).toContain('class="wpn-ai-md wpn-ai-md--streaming"');
  });
});

const DOCUMENT = [
  "# Release plan",
  "",
  "Intro with `inline code`, **bold**, *italic* and a [link](https://example.com).",
  "Second line of the same paragraph.",
  "",
  "## Steps",
  "",
  "- first item",
  "  - nested one",
  "  - nested two",
  "",
  "  continued after a blank line",
  "- second item",
  "",
  "- loose item after blank",
  "",
  "1. ordered",
  "2. ordered again",
  "   1. deep ordered",
  "",
  "```ts",
  "const a = 1;",
  "",
  "",
  "function b() {",
  "  return a;",
  "}",
  "```",
  "",
  "| Name | Type | Note |",
  "| :--- | ---: | :---: |",
  "| `id` | uuid | **pk** |",
  "| title | text | a\\|b |",
  "",
  "> quoted text",
  "> - quoted item",
  "",
  "---",
  "",
  "a | b",
  "",
  "Paragraph right before a fence",
  "```",
  "unterminated",
  "",
  "still code",
].join("\n");

const flatten = (segments: MarkdownSegment[]) => segments.flatMap((segment) => segment.blocks);

function streamPrefixes(
  text: string,
  step: number,
  check: (prefix: string, segments: MarkdownSegment[], previous: MarkdownSegment[]) => void,
) {
  let previous: MarkdownSegment[] = [];
  for (let length = 0; length <= text.length; length += step) {
    const prefix = text.slice(0, length);
    const segments = parseMarkdownSegments(prefix, previous);
    check(prefix, segments, previous);
    previous = segments;
  }
  const segments = parseMarkdownSegments(text, previous);
  check(text, segments, previous);
}

describe("AiMarkdown incremental parsing", () => {
  it("matches a full parse for every streamed prefix", () => {
    for (const step of [1, 3, 7, 16]) {
      streamPrefixes(DOCUMENT, step, (prefix, segments) => {
        expect(flatten(segments)).toEqual(parseMarkdownBlocks(prefix));
        expect(segments.map((segment) => segment.source).join("")).toBe(prefix);
      });
    }
  });

  it("splits the document into several segments", () => {
    const segments = parseMarkdownSegments(DOCUMENT);
    expect(segments.length).toBeGreaterThan(8);
    const code = segments.find((segment) => segment.source.startsWith("```ts"));
    expect(code?.blocks).toEqual([
      { kind: "code", lang: "ts", text: "const a = 1;\n\n\nfunction b() {\n  return a;\n}" },
    ]);
  });

  it("keeps completed segments and blocks by reference while streaming", () => {
    let reused = 0;
    streamPrefixes(DOCUMENT, 5, (_prefix, segments, previous) => {
      for (const segment of previous.slice(0, -1)) {
        const match = segments.find((next) => next.start === segment.start);
        if (match?.source === segment.source) {
          expect(match).toBe(segment);
          expect(match.blocks).toBe(segment.blocks);
          reused++;
        }
      }
      const kept = previous.slice(0, -1).filter((segment) => segments.includes(segment));
      expect(kept.length).toBeGreaterThanOrEqual(Math.max(0, previous.length - 2));
    });
    expect(reused).toBeGreaterThan(100);
  });

  it("returns the same segments when the text is unchanged", () => {
    const first = parseMarkdownSegments(DOCUMENT);
    const second = parseMarkdownSegments(DOCUMENT, first);
    second.forEach((segment, index) => expect(segment).toBe(first[index]));
  });

  it("re-parses correctly when earlier text is edited", () => {
    const first = parseMarkdownSegments(DOCUMENT);
    const edited = DOCUMENT.replace("## Steps", "Steps\n- injected");
    expect(flatten(parseMarkdownSegments(edited, first))).toEqual(parseMarkdownBlocks(edited));
    const shorter = DOCUMENT.slice(0, 120);
    expect(flatten(parseMarkdownSegments(shorter, first))).toEqual(parseMarkdownBlocks(shorter));
    const crlf = DOCUMENT.replace(/\n/g, "\r\n");
    expect(flatten(parseMarkdownSegments(crlf, first))).toEqual(parseMarkdownBlocks(crlf));
  });

  it("matches a full parse for random documents built from tricky lines", () => {
    const vocabulary = [
      "",
      "",
      "para text",
      "- item",
      "* star item",
      "1. one",
      "3) three",
      "  - nested",
      "    deep continuation",
      "\t- tab item",
      "  indented text",
      "```",
      "```js",
      "| a | b |",
      "|---|---|",
      "a | b",
      "> quote",
      "# heading",
      "---",
      "   ",
    ];
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let run = 0; run < 150; run++) {
      const lines = Array.from(
        { length: 4 + Math.floor(random() * 18) },
        () => vocabulary[Math.floor(random() * vocabulary.length)] as string,
      );
      const text = lines.join("\n");
      streamPrefixes(text, 1 + Math.floor(random() * 4), (prefix, segments) => {
        expect(flatten(segments)).toEqual(parseMarkdownBlocks(prefix));
      });
    }
  });

  it("renders blocks that span blank lines", () => {
    const html = render(DOCUMENT);
    expect(html).toContain(
      '<pre class="wpn-ai-md__pre" data-lang="ts"><code>const a = 1;\n\n\nfunction b()',
    );
    expect(html).toContain(
      "<ul><li>first item<ul><li>nested one</li><li>nested two continued after a blank line</li></ul></li><li>second item</li><li>loose item after blank</li></ul>",
    );
    expect(html).toContain('<th style="text-align:right">Type</th>');
    expect(html).toContain("<p>a | b</p>");
    expect(html).toContain(
      '<pre class="wpn-ai-md__pre"><code>unterminated\n\nstill code</code></pre>',
    );
  });
});
