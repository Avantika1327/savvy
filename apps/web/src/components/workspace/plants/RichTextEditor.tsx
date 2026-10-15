import { useEffect, useRef, type ClipboardEvent, type ReactNode } from "react";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react";
import { sanitizeRichTextHtml } from "../../../utils/richText";

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  label?: string;
};

type Command = "bold" | "italic" | "underline" | "strikeThrough" | "insertUnorderedList" | "insertOrderedList" | "formatBlock" | "removeFormat";

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  label = "Details",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const cleanValue = sanitizeRichTextHtml(value);
    if (cleanValue !== lastEmittedValue.current || editor.innerHTML !== cleanValue) {
      editor.innerHTML = cleanValue;
      lastEmittedValue.current = cleanValue;
    }
  }, [value]);

  function emitEditorValue() {
    const editor = editorRef.current;
    if (!editor) return;
    const cleanValue = editor.innerText.trim()
      ? sanitizeRichTextHtml(editor.innerHTML)
      : "";
    lastEmittedValue.current = cleanValue;
    onChange(cleanValue);
  }

  function runCommand(command: Command, argument?: string) {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, argument);
    emitEditorValue();
  }

  function insertLink() {
    if (disabled || !editorRef.current) return;
    const entered = window.prompt("Enter a web link (https://…) or email link (mailto:…):");
    if (!entered) return;
    const candidate = entered.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(candidate)) {
      window.alert("Use a link starting with https://, http://, or mailto:.");
      return;
    }
    editorRef.current.focus();
    document.execCommand("createLink", false, candidate);
    emitEditorValue();
  }

  function handleInput() {
    const editor = editorRef.current;
    if (!editor) return;
    const cleanValue = editor.innerText.trim()
      ? sanitizeRichTextHtml(editor.innerHTML)
      : "";
    lastEmittedValue.current = cleanValue;
    onChange(cleanValue);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    // Paste text only so source HTML/scripts/styles never enter the editable region.
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    handleInput();
  }

  const tool = (title: string, icon: ReactNode, onClick: () => void) => (
    <button
      key={title}
      type="button"
      className="plant-editor-tool"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <div className="plant-rich-editor">
      <div className="plant-rich-editor-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        {tool("Bold", <Bold size={15} />, () => runCommand("bold"))}
        {tool("Italic", <Italic size={15} />, () => runCommand("italic"))}
        {tool("Underline", <Underline size={15} />, () => runCommand("underline"))}
        {tool("Strikethrough", <Strikethrough size={15} />, () => runCommand("strikeThrough"))}
        <span className="plant-editor-divider" />
        {tool("Heading 2", <Heading2 size={15} />, () => runCommand("formatBlock", "h2"))}
        {tool("Bulleted list", <List size={15} />, () => runCommand("insertUnorderedList"))}
        {tool("Numbered list", <ListOrdered size={15} />, () => runCommand("insertOrderedList"))}
        {tool("Quote", <Quote size={15} />, () => runCommand("formatBlock", "blockquote"))}
        {tool("Insert link", <LinkIcon size={15} />, insertLink)}
        {tool("Code block", <Code size={15} />, () => runCommand("formatBlock", "pre"))}
        {tool("Clear formatting", <RemoveFormatting size={15} />, () => runCommand("removeFormat"))}
      </div>
      <div
        ref={editorRef}
        className="plant-rich-editor-content"
        contentEditable={!disabled}
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        aria-disabled={disabled}
        data-placeholder="Add plant details…"
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={handleInput}
        suppressContentEditableWarning
      />
    </div>
  );
}
