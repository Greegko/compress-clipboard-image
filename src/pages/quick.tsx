import { calculateThumbnail, convertImage, getFileDimensions } from "../utils/convert-image";
import { useImagePaste } from "../utils/paste-image";

export const downloadBlob = (content: Blob, filename: string) => {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const QuickPage = () => {
  const quickConvertAndDownload = async (file: File) => {
    const fileDimensions = await getFileDimensions(file);

    convertImage(file, calculateThumbnail(fileDimensions, 1024)).then(x => downloadBlob(x, file.name));
  };

  useImagePaste(file => quickConvertAndDownload(file));

  const onDragAndDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      [...e.dataTransfer.items].forEach(item => {
        quickConvertAndDownload(item.getAsFile());
      });
    }

    return false;
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      class="text-white h-full border p-4 border-dashed border-gray-600 text-2xl"
      onDrop={onDragAndDrop}
      onDragOver={onDragOver}
    >
      Drag and Drop or Paste from Clipboard the image!
    </div>
  );
};
