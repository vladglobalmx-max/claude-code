"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // onMouseDown + preventDefault: evita que el botón le robe el foco al
      // editor antes de aplicar el comando (mismo patrón recomendado por
      // Tiptap) — sin esto, aplicar un formato sobre texto seleccionado
      // perdería la selección.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent"
      )}
    >
      {children}
    </button>
  );
}

/**
 * THÖREN 0086 — editor de texto enriquecido para
 * quote_items.customer_requirements ("Requisitos del cliente"). Alcance
 * intencionalmente acotado (StarterKit + alineación) — negrita, cursiva,
 * subrayado, listas, alineación, deshacer/rehacer. Nada de imágenes,
 * tablas, links, encabezados ni color de texto: esto sigue siendo un campo
 * de requisitos por partida, no un editor de documentos genérico. El HTML
 * que produce se sanitiza SIEMPRE server-side antes de persistirse (ver
 * src/lib/rich-text.ts, llamado desde el zod transform en
 * src/lib/validations/quote.ts) — este componente nunca es la única
 * barrera de seguridad.
 */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false, link: false }),
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // whitespace-pre-wrap: texto plano legacy (sin ninguna etiqueta)
        // llega a Tiptap como un solo nodo de texto con saltos de línea
        // literales — sin esto el área editable los colapsaría visualmente
        // en una sola línea mientras se edita (RichTextView, la vista de
        // solo lectura, ya lo maneja con su propio whitespace-pre-line).
        class:
          "min-h-[96px] whitespace-pre-wrap rounded-b-lg border border-t-0 border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  if (!editor) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-border bg-surface-2 p-1">
        <ToolbarButton
          label="Negrita"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Cursiva"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Subrayado"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <ToolbarButton
          label="Lista con viñetas"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <ToolbarButton
          label="Alinear a la izquierda"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Centrar"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Alinear a la derecha"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <ToolbarButton
          label="Deshacer"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Rehacer"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
