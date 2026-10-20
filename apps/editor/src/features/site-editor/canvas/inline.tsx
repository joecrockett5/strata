// Inline editors rendered inside the canvas iframe. They are styled only by canvasCss (stx-*),
// because the editor's Tailwind styles do not reach into the iframe.
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { Lock } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { richTextExtensions } from "@/components/richtext/extensions";

/** Single-line text slot edited in place with plain contentEditable. */
export function InlineText({
  value,
  label,
  maxLength,
  onChange,
  onFocus,
}: {
  value: string;
  label: string;
  maxLength: number | undefined;
  onChange: (text: string) => void;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  // The DOM owns the text while typing; only write it when the value changed elsewhere (undo, redo).
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.textContent !== value) element.textContent = value;
  }, [value]);

  const over = maxLength !== undefined && value.length > maxLength;
  return (
    <span
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-invalid={over || undefined}
      title={over ? `Too long: ${String(value.length)} of ${String(maxLength)} characters` : undefined}
      data-stx-editable=""
      data-stx-history="document"
      data-stx-placeholder={label}
      {...(value === "" ? { "data-stx-empty": "" } : {})}
      {...(over ? { "data-stx-over": "" } : {})}
      onInput={(event) => {
        onChange(event.currentTarget.textContent);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onFocus={onFocus}
    />
  );
}

/** Rich text slot edited in place with TipTap; the formatting toolbar lives in the editor chrome. */
export function InlineRichText({
  value,
  label,
  onChange,
  onActivate,
}: {
  value: string;
  label: string;
  onChange: (html: string) => void;
  onActivate: (editor: Editor) => void;
}) {
  const onChangeRef = useRef(onChange);
  const onActivateRef = useRef(onActivate);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onActivateRef.current = onActivate;
  });

  const editor = useEditor({
    extensions: richTextExtensions,
    content: value,
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
        class: "stx-prose",
        "data-stx-history": "document",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.isEmpty ? "" : e.getHTML());
    },
    onFocus: ({ editor: e }) => {
      onActivateRef.current(e);
    },
  });

  // Follow changes made elsewhere (undo/redo); typing round-trips the same HTML, so it is a no-op.
  useEffect(() => {
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="stx-richtext-edit">
      <EditorContent editor={editor} />
    </div>
  );
}

const lockedTitle = {
  slot: "Locked by the template designer. Site owners can't change this content.",
  section: "This section is locked by the template designer.",
};

/** Read-only content with a lock indicator and tooltip (rule 1 / rule 2 in the editor). */
export function Locked({
  reason,
  children,
  block = false,
}: {
  reason: keyof typeof lockedTitle;
  children: ReactNode;
  block?: boolean;
}) {
  const Tag = block ? "div" : "span";
  return (
    <Tag className="stx-locked" title={lockedTitle[reason]} data-stx-locked={reason}>
      {children}
      {block ? null : <Lock className="stx-lock-icon" aria-label="Locked" role="img" />}
    </Tag>
  );
}
