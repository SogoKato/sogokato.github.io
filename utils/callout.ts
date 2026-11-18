// remark plugin for GitHub-style alerts.
//
//   > [!NOTE]
//   > 本文（Markdown が使える）
//
// NOTE, TIP, WARNING and CAUTION are supported. Any other blockquote,
// including GitHub's [!IMPORTANT], is left as a normal blockquote.
// The output is
//
//   <aside class="callout callout-note">
//     <div class="callout-title"><svg>…</svg>メモ</div>
//     <div class="callout-body">…</div>
//   </aside>

// Only the parts of mdast/hast used here, so no type package is needed.
type Node = {
  type: string;
  value?: string;
  children?: Node[];
  data?: Record<string, unknown>;
};

type HastElement = {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
  children: (HastElement | HastText)[];
};

type HastText = { type: "text"; value: string };

type CalloutType = "note" | "tip" | "warning" | "caution";

const TITLES: Record<CalloutType, string> = {
  note: "メモ",
  tip: "ヒント",
  warning: "注意",
  caution: "警告",
};

// Icons from Lucide v1.65.0 (info, lightbulb, triangle-alert,
// octagon-alert), drawn as strokes in the type's colour.
// https://lucide.dev — ISC License, Copyright (c) 2026 Lucide Icons and Contributors
type Shape = [tagName: string, properties: Record<string, string>];
const ICONS: Record<CalloutType, Shape[]> = {
  note: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 16v-4" }],
    ["path", { d: "M12 8h.01" }],
  ],
  tip: [
    ["path", { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" }],
    ["path", { d: "M9 18h6" }],
    ["path", { d: "M10 22h4" }],
  ],
  warning: [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  caution: [
    ["path", { d: "M12 16h.01" }],
    ["path", { d: "M12 8v4" }],
    ["path", { d: "M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z" }],
  ],
};

const MARKER = /^\[!(note|tip|warning|caution)\][ \t]*(?:\n|$)/i;

const el = (
  tagName: string,
  properties: Record<string, unknown>,
  children: HastElement[] = [],
): HastElement => ({ type: "element", tagName, properties, children });

const icon = (type: CalloutType): HastElement =>
  el("svg", { viewBox: "0 0 24 24", ariaHidden: "true", focusable: "false" }, [
    ...ICONS[type].map(([tagName, properties]) => el(tagName, properties)),
  ]);

// Removes the [!TYPE] line from the first paragraph and returns the type.
const takeMarker = (quote: Node): CalloutType | null => {
  const first = quote.children?.[0];
  const text = first?.type === "paragraph" ? first.children?.[0] : undefined;
  if (text?.type !== "text" || text.value === undefined) return null;
  const match = MARKER.exec(text.value);
  if (!match) return null;

  text.value = text.value.slice(match[0].length);
  const rest = first!.children!;
  if (text.value === "") {
    rest.shift();
    // "[!NOTE]" followed by a hard line break ("\" or two spaces).
    if (rest[0]?.type === "break") rest.shift();
  }
  if (rest.length === 0) quote.children!.shift();
  return match[1].toLowerCase() as CalloutType;
};

const visit = (node: Node) => {
  node.children?.forEach(visit);
  if (node.type !== "blockquote") return;
  const type = takeMarker(node);
  if (type === null) return;

  const body: Node = {
    type: "calloutBody",
    children: node.children ?? [],
    data: { hName: "div", hProperties: { className: ["callout-body"] } },
  };
  const title: Node = {
    type: "calloutTitle",
    data: {
      hName: "div",
      hProperties: { className: ["callout-title"] },
      hChildren: [icon(type), { type: "text", value: TITLES[type] }],
    },
  };
  node.children = [title, body];
  node.data = {
    ...node.data,
    hName: "aside",
    hProperties: { className: ["callout", `callout-${type}`] },
  };
};

const remarkCallout = () => (tree: Node) => {
  visit(tree);
};

export default remarkCallout;
