import { Select } from "antd";
import ImageTransformer, { MimeType } from "js-image-lib";
import { useEffect, useState } from "react";

import { formatBytes } from "./utils/format-bytes";
import { hookImagePaste } from "./utils/paste-image";

interface EditorSettings {
  quality: number;
}

export const App = () => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [alteredImage, setAlteredImage] = useState<Blob | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({ quality: 92 });

  useEffect(() => {
    hookImagePaste(file => {
      setOriginalImage(file);

      const image = new Image();
      image.onload = function (e) {
        console.log(image.height, e);
      };

      image.src = URL.createObjectURL(file!);
    });
  }, []);

  useEffect(() => {
    if (!originalImage) return;

    originalImage
      .arrayBuffer()
      .then(arrBuff => new ImageTransformer(new Uint8Array(arrBuff)))
      .then(transformer => {
        // transformer.resize(200);
        transformer.outputOptions.quality = editorSettings.quality;

        setAlteredImage(new Blob([transformer.toBuffer(MimeType.JPEG)]));
      });
  }, [editorSettings, originalImage]);

  return (
    <div style={{ display: "flex" }}>
      <div style={{ flex: "1" }}>
        <h2>Original Image</h2>
        <DisplayImage image={originalImage} />
      </div>

      <Editor
        editorSettings={editorSettings}
        originalImage={originalImage}
        onEditorSettingsChanged={settings => (console.log(settings), setEditorSettings(settings))}
      />

      <div style={{ flex: "1" }}>
        <h2>Transformed Image</h2>
        <DisplayImage image={alteredImage} />
      </div>
    </div>
  );
};

const DisplayImage = ({ image }: { image: File | Blob | null }) => {
  if (!image) return <div>No Image!</div>;

  return (
    <div>
      <div>File Size: {formatBytes(image.size)}</div>

      <img src={URL.createObjectURL(image)} style={{ maxHeight: "75vh" }} />
    </div>
  );
};

interface EditorProperties {
  originalImage: File | null;
  editorSettings: EditorSettings;
  onEditorSettingsChanged: (settings: EditorSettings) => void;
}

const Editor = ({ originalImage, editorSettings, onEditorSettingsChanged }: EditorProperties) => {
  console.log(originalImage);
  return (
    <div style={{ width: 350 }}>
      <h2>Editor</h2>
      <h3>Convert</h3>
      Quality:{" "}
      <Select
        style={{ width: 120 }}
        value={editorSettings.quality}
        options={[
          { label: 100, value: 100 },
          { label: 92, value: 92 },
          { label: 85, value: 85 },
          { label: 50, value: 50 },
        ]}
        onChange={quality => onEditorSettingsChanged({ quality })}
      />
      <h3>Resize</h3>
      Ratio: Height: Width: Keep Ratio: [x]
    </div>
  );
};
