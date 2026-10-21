import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";
import { Markdown, type MarkdownProps } from "@/components/common/markdown";
import common from "../../messages/ar/common.json";

// Test files are .ts, so elements are built with jsx() (what compiled JSX calls).
function render(source: string, props: Omit<MarkdownProps, "children"> = {}): string {
  return renderAll([source], props);
}

/** Renders several Markdown blocks on one page (like a chat with several replies). */
function renderAll(sources: string[], props: Omit<MarkdownProps, "children"> = {}): string {
  const blocks = sources.map((source, index) => jsx(Markdown, { ...props, children: source }, index));
  return renderToStaticMarkup(
    jsx(NextIntlClientProvider, { locale: "ar", messages: { common }, children: blocks }),
  );
}

const values = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1]);

describe("Markdown", () => {
  it("drops raw HTML, scripts and event handlers", () => {
    const html = render(
      [
        "<script>alert(1)</script>",
        "",
        '<img src="https://x.test/a.png" onerror="alert(2)">',
        "",
        'Hi <a href="https://x.test" onclick="alert(3)">there</a> <b style="color:red">bold</b>',
        "",
        '<iframe src="https://evil.test"></iframe><svg onload="alert(4)"></svg>',
      ].join("\n"),
    );
    expect(html).not.toMatch(/<script|<iframe|<svg|<img|onerror|onclick|onload|style=/i);
    expect(html).not.toContain("alert(");
  });

  it("neutralizes javascript:, data: and other unsafe link targets", () => {
    const html = render(
      [
        "[a](javascript:alert(1))",
        "[b](JaVaScRiPt:alert(1))",
        "[c](  javascript:alert(1))",
        "[d](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
        "[e](vbscript:msgbox(1))",
        "<javascript:alert(1)>",
        "[f](/admin/delete-everything)",
        "[g](//evil.test/x)",
      ].join("\n\n"),
    );
    // The text may stay visible; what matters is that nothing is a link.
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/(href|src)="[^"]*(javascript|data|vbscript):/i);
    expect(html).not.toMatch(/href="\//);
  });

  it("opens safe links in a new tab without opener or referrer", () => {
    const html = render(
      "[docs](https://example.com/a?b=1) and [mail](mailto:teacher@school.test) and [note](#fn-1)",
    );
    expect(html).toContain('href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('href="mailto:teacher@school.test" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(common.content.newTab);
    // In-page anchors stay in the same tab.
    expect(html).toMatch(/<a (?![^>]*target=)[^>]*href="#fn-1"[^>]*>note<\/a>/);
  });

  it("only renders https images (when enabled), without leaking the referrer", () => {
    const html = render(
      "![safe](https://cdn.test/a.png) ![insecure](http://cdn.test/b.png) ![data](data:image/png;base64,AAAA)",
      { images: true },
    );
    expect(html).toContain('src="https://cdn.test/a.png"');
    expect(html).toMatch(/referrerPolicy="no-referrer"/i);
    expect(html).not.toContain("http://cdn.test/b.png");
    expect(html).not.toContain("data:image");
    expect(render("![x](https://cdn.test/a.png)", { images: false })).not.toContain("<img");
  });

  it("regression: third-party images (tracking pixels) are off unless asked for", () => {
    expect(render("![x](https://tracker.test/pixel.png)")).not.toContain("<img");
  });

  it("renders inline and display math with KaTeX, with dangerous commands disabled", () => {
    const html = render("Area: $\\pi r^2$\n\n$$\n\\frac{a}{b}\n$$\n\n$\\href{javascript:alert(1)}{x}$");
    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
    expect(html).toContain("<math");
    // \href is refused (trust: false): its source is shown as an error, never as a link.
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/href="javascript/i);
  });

  it("wraps tables in a focusable, horizontally scrolling region", () => {
    const html = render("| الاسم | الدرجة |\n| --- | --- |\n| سارة | 9 |");
    expect(html).toContain(`role="region" aria-label="${common.content.table}" tabindex="0"`);
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<table");
  });

  it("lets mixed Arabic/English blocks pick their own direction and keeps code LTR", () => {
    const html = render("# عنوان\n\nمرحبا Hello\n\n- بند\n\n> اقتباس\n\n```js\nconst x = 1;\n```");
    expect(html).toMatch(/<h2 dir="auto"/);
    expect(html).toMatch(/<p dir="auto"/);
    expect(html).toMatch(/<li dir="auto"/);
    expect(html).toMatch(/<blockquote dir="auto"/);
    expect(html).toMatch(/<pre dir="ltr"[^>]*class="[^"]*\[&amp;&gt;code\]:\[direction:ltr\]/);
    expect(html).toMatch(/<code[^>]*class="[^"]*language-js/);
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/);
  });

  it("renders partial Markdown while a reply is streaming", () => {
    for (const partial of [
      "**bold",
      "```py\nprint(",
      "| a | b |\n| --",
      "$$\\frac{1}{",
      "[link](https://exa",
      "- item\n- ",
    ]) {
      expect(() => render(partial)).not.toThrow();
    }
    expect(render("$$\\frac{1}{")).not.toContain("<script");
  });

  it("keeps GFM task lists as disabled checkboxes", () => {
    const html = render("- [x] done\n- [ ] todo");
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*disabled/);
  });

  it("renders footnotes with working links and translated, screen-reader-only labels", () => {
    const html = render("Text[^1] and again[^1], see also[^note].\n\n[^1]: First.\n\n[^note]: Second.");
    const ids = values(html, /\sid="([^"]+)"/g);
    const anchors = values(html, /href="#([^"]+)"/g);

    // Three references and a back-link for each of them; every link lands on an element.
    expect(anchors).toHaveLength(6);
    for (const target of anchors) expect(ids).toContain(target);
    expect(html).not.toContain("user-content-user-content");
    const describedBy = values(html, /aria-describedby="([^"]+)"/g);
    expect(describedBy).toHaveLength(3);
    for (const label of describedBy) expect(ids).toContain(label);

    // The section label is translated and visually hidden; no English default text is left.
    expect(html).not.toMatch(/Footnotes|Back to reference|Back to content/);
    expect(html).toMatch(
      new RegExp(
        `<h3(?=[^>]*\\sid=")(?=[^>]*class="[^"]*\\bsr-only\\b)[^>]*>${common.content.footnotes}</h3>`,
      ),
    );

    // Back-links keep their footnote attributes and get a translated accessible name.
    const back = (number: string) => common.content.footnoteBack.replace("{number}", number);
    expect(html).toMatch(new RegExp(`<a(?=[^>]*data-footnote-backref)[^>]*aria-label="${back("1")}"`));
    expect(html).toContain(`aria-label="${back("1-2")}"`);
    expect(html).toContain(`aria-label="${back("2")}"`);
    expect(html).toMatch(/<a(?=[^>]*data-footnote-ref)(?=[^>]*\sid=")[^>]*href="#/);
  });

  it("keeps footnote ids unique when several replies are on one page", () => {
    const html = renderAll(["A[^1]\n\n[^1]: one", "B[^1]\n\n[^1]: two"]);
    const ids = values(html, /\sid="([^"]+)"/g);
    expect(ids).toHaveLength(6); // per reply: the reference, the footnote and the label
    expect(new Set(ids).size).toBe(ids.length);
    for (const target of values(html, /href="#([^"]+)"/g)) expect(ids).toContain(target);
  });
});
