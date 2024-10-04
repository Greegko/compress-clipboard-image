export function useImagePaste(cb: (file: File | null) => void) {
  const pasteFn = (evt: ClipboardEvent) => {
    const clipboardItems = evt.clipboardData!.items;
    const items = [...clipboardItems].filter(item => item.type.includes("image"));

    if (items.length === 0) {
      return;
    }

    const item = items[0];
    cb(item.getAsFile());
  };

  document.addEventListener("paste", pasteFn);

  return () => document.removeEventListener("paste", pasteFn);
}
