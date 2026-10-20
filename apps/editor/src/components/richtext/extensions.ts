import StarterKit from "@tiptap/starter-kit";

export const allowedLink = /^(https?:\/\/|mailto:|tel:)/i;

/**
 * Rich text limited to what the server's sanitiser keeps: paragraphs, bold, italic, links
 * (http(s), mailto, tel) and bulleted/numbered lists. Everything else in StarterKit is disabled.
 */
export const richTextExtensions = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    dropcursor: false,
    gapcursor: false,
    undoRedo: false, // the editor's document history handles undo
    link: {
      openOnClick: false,
      autolink: true,
      protocols: ["mailto", "tel"],
      isAllowedUri: (url) => allowedLink.test(url),
      HTMLAttributes: { rel: null, target: null },
    },
  }),
];
