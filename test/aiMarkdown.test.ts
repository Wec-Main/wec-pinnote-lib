import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiMarkdown, parseMarkdownBlocks, safeHref } from "../src/components/Ai/AiMarkdown";

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
