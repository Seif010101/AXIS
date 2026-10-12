import "katex/dist/katex.min.css";
import { useTranslations } from "next-intl";
import { memo, useMemo } from "react";
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

// Safe Markdown for AI output and user-written rich text (docs/CONVENTIONS.md §6).
//
// Pipeline: Markdown (GFM + math) → HTML tree → sanitize → KaTeX. Raw HTML in the source is
// dropped, the sanitizer removes scripts, event handlers, styles and unsafe URLs, and only
// then are the math nodes the sanitizer kept turned into KaTeX markup (KaTeX runs with
// `trust: false`, so \href and \html* commands are disabled). Links may only be http(s),
// mailto or in-page anchors; images only https.

const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Keep code languages and the classes remark-math puts on math (for rehype-katex).
    code: [["className", /^language-[\w-]+$/, "math-inline", "math-display"]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["https"],
    cite: ["http", "https"],
  },
};

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Second line of defense after the sanitizer: anything unexpected loses its URL. */
const urlTransform: UrlTransform = (url, key) => {
  const value = url.trim();
  if (key === "href" && value.startsWith("#")) return value;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null; // relative or malformed
  }
  if (key === "href") return ALLOWED_LINK_PROTOCOLS.has(parsed.protocol) ? value : null;
  if (key === "src") return parsed.protocol === "https:" ? value : null;
  return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
};

/** Drops react-markdown's `node` prop so it never reaches the DOM. */
function domProps<P extends { node?: unknown }>(props: P): Omit<P, "node"> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

type Size = "sm" | "base";

type Translate = ReturnType<typeof useTranslations<"common">>;

function buildComponents(t: Translate, size: Size, images: boolean): Components {
  const heading = size === "sm" ? ["text-lg", "text-base", "text-base"] : ["text-2xl", "text-xl", "text-lg"];
  return {
    h1: (props) => (
      <h2 dir="auto" {...domProps(props)} className={cn("mt-6 mb-3 font-heading font-bold", heading[0])} />
    ),
    h2: (props) => (
      <h3
        dir="auto"
        {...domProps(props)}
        className={cn("mt-5 mb-2 font-heading font-semibold", heading[1])}
      />
    ),
    h3: (props) => (
      <h4
        dir="auto"
        {...domProps(props)}
        className={cn("mt-4 mb-2 font-heading font-semibold", heading[2])}
      />
    ),
    h4: (props) => <h5 dir="auto" {...domProps(props)} className="mt-4 mb-2 font-semibold" />,
    h5: (props) => <h6 dir="auto" {...domProps(props)} className="mt-3 mb-1 font-semibold" />,
    h6: (props) => (
      <h6 dir="auto" {...domProps(props)} className="mt-3 mb-1 font-medium text-muted-foreground" />
    ),
    p: (props) => <p dir="auto" {...domProps(props)} className="my-3 leading-relaxed" />,
    ul: (props) => (
      <ul
        dir="auto"
        {...domProps(props)}
        className={cn(
          "my-3 list-disc space-y-1 ps-6 marker:text-muted-foreground",
          props.className?.includes("contains-task-list") && "list-none ps-1",
        )}
      />
    ),
    ol: (props) => (
      <ol
        dir="auto"
        {...domProps(props)}
        className="my-3 list-decimal space-y-1 ps-6 marker:text-muted-foreground"
      />
    ),
    li: (props) => <li dir="auto" {...domProps(props)} className="ps-1 leading-relaxed" />,
    blockquote: (props) => (
      <blockquote
        dir="auto"
        {...domProps(props)}
        className="my-4 border-s-4 border-border ps-4 text-muted-foreground"
      />
    ),
    hr: () => <hr className="my-6 border-border" />,
    a: ({ node, href, children }) => {
      void node;
      if (!href) return <span>{children}</span>;
      const anchorClass = "font-medium text-primary underline underline-offset-4 hover:no-underline";
      if (href.startsWith("#")) {
        return (
          <a href={href} className={anchorClass}>
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={anchorClass}>
          {children}
          <span className="sr-only"> {t("content.newTab")}</span>
        </a>
      );
    },
    img: ({ node, src, alt }) => {
      void node;
      if (!images || typeof src !== "string" || !src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary https images from AI or user content can't go through next/image's fixed remote allowlist
        <img
          src={src}
          alt={alt || t("content.image")}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="my-3 h-auto max-w-full rounded-lg border border-border"
        />
      );
    },
    table: (props) => (
      <div
        role="region"
        aria-label={t("content.table")}
        tabIndex={0}
        className="my-4 w-full overflow-x-auto rounded-lg border border-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <table dir="auto" {...domProps(props)} className="w-full border-collapse text-sm" />
      </div>
    ),
    thead: (props) => <thead {...domProps(props)} className="bg-muted/60" />,
    th: (props) => (
      <th
        dir="auto"
        {...domProps(props)}
        className="border-b border-border px-3 py-2 text-start font-semibold whitespace-nowrap"
      />
    ),
    td: (props) => (
      <td dir="auto" {...domProps(props)} className="border-b border-border px-3 py-2 align-top" />
    ),
    // Code blocks are always left-to-right (the CSS direction overrides the dir="auto" that
    // inline code gets below, which would flip a block starting with an Arabic comment).
    pre: (props) => (
      <pre
        dir="ltr"
        {...domProps(props)}
        className="my-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm leading-relaxed [&>code]:bg-transparent [&>code]:p-0 [&>code]:[direction:ltr]"
      />
    ),
    // Inline code picks its own direction, so `x = 1` stays intact inside Arabic text.
    code: (props) => (
      <code
        dir="auto"
        {...domProps(props)}
        className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]", props.className)}
      />
    ),
    input: (props) => <input {...domProps(props)} className="me-2 align-middle" />,
  };
}

export interface MarkdownProps {
  /** Markdown source. Partial input (while streaming) is fine. */
  children: string;
  className?: string;
  /** Smaller headings for chat bubbles and cards. */
  size?: Size;
  /** Render https images (default true). Turn off where third-party image loads are unwanted. */
  images?: boolean;
}

function MarkdownImpl({ children, className, size = "base", images = true }: MarkdownProps) {
  const t = useTranslations("common");
  // Stable component identities, so streaming updates don't remount the rendered tree.
  const components = useMemo(() => buildComponents(t, size, images), [t, size, images]);
  return (
    <div
      className={cn(
        "min-w-0 text-foreground [overflow-wrap:anywhere] [&>:first-child]:mt-0 [&>:last-child]:mb-0",
        "[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1",
        size === "sm" ? "text-sm" : "text-base",
        className,
      )}
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeSanitize, schema],
          [
            rehypeKatex,
            { trust: false, strict: "ignore", maxSize: 20, maxExpand: 300, output: "htmlAndMathml" },
          ],
        ]}
        urlTransform={urlTransform}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Renders untrusted Markdown (AI replies, user rich text) safely, with GFM tables/task
 * lists and KaTeX math. Works in server and client components and while a reply streams.
 *
 * @example
 * <Markdown>{message.content}</Markdown>
 * <Markdown size="sm" images={false}>{studentNote}</Markdown>
 */
export const Markdown = memo(MarkdownImpl);
