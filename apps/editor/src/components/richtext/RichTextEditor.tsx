import { EditorContent, useEditor } from "@tiptap/react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { allowedLink, richTextExtensions } from "./extensions";

export function RichTextEditor({
  value,
  onChange,
  label,
  className,
  autoFocus = false,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const editor = useEditor({
    extensions: richTextExtensions,
    content: value,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { "aria-label": label, role: "textbox", "aria-multiline": "true", class: "stx-prose" },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.isEmpty ? "" : e.getHTML());
    },
  });

  // Follow external changes (undo/redo) without clobbering the cursor while typing.
  useEffect(() => {
    if (!editor.isFocused && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div
      className={cn("rounded-md border border-slate-300 bg-white focus-within:border-blue-600", className)}
    >
      <RichTextToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose-sm max-h-72 overflow-y-auto px-3 py-2 text-sm [&_.ProseMirror]:min-h-16 [&_.ProseMirror]:outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}

export function RichTextToolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");

  const applyLink = () => {
    const url = href.trim();
    if (url === "") editor.chain().focus().unsetLink().run();
    else if (allowedLink.test(url))
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const button = (label: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <IconButton
      label={label}
      aria-pressed={active}
      className={cn(active && "bg-slate-200 text-slate-900")}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the selection in the editor
      }}
      onClick={run}
    >
      {icon}
    </IconButton>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-1 py-0.5">
      {button(
        "Bold",
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        <Bold className="size-3.5" />,
      )}
      {button(
        "Italic",
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        <Italic className="size-3.5" />,
      )}
      {button(
        "Bulleted list",
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        <List className="size-3.5" />,
      )}
      {button(
        "Numbered list",
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListOrdered className="size-3.5" />,
      )}
      {button(
        "Link",
        editor.isActive("link"),
        () => {
          setHref((editor.getAttributes("link").href as string | undefined) ?? "https://");
          setLinkOpen((open) => !open);
        },
        <LinkIcon className="size-3.5" />,
      )}
      {editor.isActive("link")
        ? button(
            "Remove link",
            false,
            () => editor.chain().focus().unsetLink().run(),
            <Unlink className="size-3.5" />,
          )
        : null}
      {linkOpen ? (
        <form
          className="flex w-full items-center gap-1 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            aria-label="Link URL"
            className="h-7 flex-1 rounded border border-slate-300 px-2 text-xs"
            value={href}
            onChange={(e) => {
              setHref(e.target.value);
            }}
            placeholder="https://, mailto: or tel:"
          />
          <button type="submit" className="h-7 rounded bg-slate-900 px-2 text-xs text-white">
            Apply
          </button>
          {href !== "" && !allowedLink.test(href.trim()) ? (
            <span className="text-xs text-red-700">Use http(s), mailto or tel</span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
