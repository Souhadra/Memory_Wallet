/**
 * Read the text of a rich-text composer (ProseMirror and friends) WITH its line breaks.
 *
 * `textContent` joins block elements with no separator ("line one" + "line two" becomes
 * "line oneline two"). The wallet reads the held draft, uses it for retrieval, and re-inserts
 * it on Deny / no-match, so that silently mangled every multi-line message it intercepted.
 *
 * This walks the tree instead: every block element is one line, <br> is a line break, and an
 * empty paragraph (ProseMirror pads it with a lone trailing <br>) is a blank line.
 *
 * Written against a minimal node shape (not the DOM types) so the unit test can run in Node.
 */
export interface TextNodeLike {
  nodeType: number;
  nodeValue?: string | null;
  tagName?: string;
  childNodes?: ArrayLike<TextNodeLike>;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const BLOCK_TAGS = new Set([
  "P", "DIV", "LI", "UL", "OL", "PRE", "BLOCKQUOTE",
  "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "TR",
]);

const tagOf = (node: TextNodeLike): string => (node.tagName ?? "").toUpperCase();
const isBlock = (node: TextNodeLike): boolean =>
  node.nodeType === ELEMENT_NODE && BLOCK_TAGS.has(tagOf(node));

export function readEditableText(root: TextNodeLike): string {
  const lines: string[] = [];
  let cur = "";
  const endLine = (): void => {
    lines.push(cur);
    cur = "";
  };

  const walkChildren = (node: TextNodeLike): void => {
    const kids = Array.from(node.childNodes ?? []);
    kids.forEach((kid, i) => walk(kid, i === kids.length - 1));
  };

  const walk = (node: TextNodeLike, isLastChild: boolean): void => {
    if (node.nodeType === TEXT_NODE) {
      cur += node.nodeValue ?? "";
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;

    if (tagOf(node) === "BR") {
      // A lone <br> that only pads an empty block adds no line of its own: the block's
      // end already emits that (empty) line.
      if (isLastChild && cur === "") return;
      endLine();
      return;
    }

    const block = isBlock(node);
    if (block && cur !== "") endLine(); // text that came before this block is its own line
    walkChildren(node);
    if (block) {
      // A container whose children are blocks has already emitted its lines.
      const hasBlockChild = Array.from(node.childNodes ?? []).some(isBlock);
      if (!hasBlockChild || cur !== "") endLine();
    }
  };

  walkChildren(root);
  if (cur !== "") endLine();
  return lines.join("\n");
}
