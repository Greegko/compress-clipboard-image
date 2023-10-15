import { Checkbox, InputNumber, Select } from "antd";
import ImageTransformer, { MimeType } from "js-image-lib";
import { last } from "lodash-es";
import debounce from "lodash-es/debounce";
import { DragEventHandler, useCallback, useEffect, useState } from "react";

import { formatBytes } from "./utils/format-bytes";
import { hookImagePaste } from "./utils/paste-image";

interface EditorSettings {
  quality: number;
  width: number;
  height: number;
}

export const App = () => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [alteredImage, setAlteredImage] = useState<Blob | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({ quality: 92, width: 0, height: 0 });

  useEffect(() => {
    hookImagePaste(file => setOriginalImage(file));
  }, []);

  useEffect(() => {
    if (!originalImage) return;

    originalImage
      .arrayBuffer()
      .then(arrBuff => new ImageTransformer(new Uint8Array(arrBuff)))
      .then(transformer => {
        setEditorSettings(settings => ({
          height: transformer.height,
          width: transformer.width,
          quality: settings.quality,
        }));
      });
  }, [originalImage]);

  useEffect(() => {
    if (!originalImage) return;

    originalImage
      .arrayBuffer()
      .then(arrBuff => new ImageTransformer(new Uint8Array(arrBuff)))
      .then(transformer => {
        if (editorSettings.width && editorSettings.height) {
          transformer.resize(editorSettings.width, editorSettings.height);
        }

        transformer.outputOptions.quality = editorSettings.quality;

        setAlteredImage(new Blob([transformer.toBuffer(MimeType.JPEG)]));
      });
  }, [editorSettings, originalImage]);

  const onDragAndDrop: DragEventHandler<HTMLDivElement> = useCallback(e => {
    if (e.dataTransfer.files) setOriginalImage(last(e.dataTransfer.files)!);

    e.preventDefault();
    return false;
  }, []);

  return (
    <div
      style={{ display: "flex", height: "100%" }}
      onDrop={onDragAndDrop}
      onDragOver={onDragAndDrop}
      onDragEnter={onDragAndDrop}
    >
      <div style={{ flex: "1" }}>
        <h2>Original Image</h2>
        <DisplayImage image={originalImage} />
      </div>

      <Editor editorSettings={editorSettings} onEditorSettingsChanged={settings => setEditorSettings(settings)} />

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
  editorSettings: EditorSettings;
  onEditorSettingsChanged: (settings: EditorSettings) => void;
}

const Editor = ({ editorSettings, onEditorSettingsChanged }: EditorProperties) => {
  const [keetRatio, setKeepRatio] = useState<boolean>(true);

  const updateHeightWidth = useCallback(
    debounce(({ height, width }: { height?: number | null; width?: number | null }) => {
      if (height) {
        if (keetRatio)
          onEditorSettingsChanged({
            height,
            width: Math.ceil((height / editorSettings.height) * editorSettings.width),
            quality: editorSettings.quality,
          });
        if (!keetRatio)
          onEditorSettingsChanged({ height, width: editorSettings.width, quality: editorSettings.quality });
      }

      if (width) {
        if (keetRatio)
          onEditorSettingsChanged({
            height: Math.ceil((width / editorSettings.width) * editorSettings.height),
            width,
            quality: editorSettings.quality,
          });
        if (!keetRatio)
          onEditorSettingsChanged({ height: editorSettings.height, width, quality: editorSettings.quality });
      }
    }, 300),
    [editorSettings, keetRatio],
  );

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
        onChange={quality =>
          onEditorSettingsChanged({ quality, height: editorSettings.height, width: editorSettings.width })
        }
      />
      <h3>Resize</h3>
      Height:{" "}
      <InputNumber size="small" value={editorSettings.height} onChange={height => updateHeightWidth({ height })} />{" "}
      Width: <InputNumber size="small" value={editorSettings.width} onChange={width => updateHeightWidth({ width })} />
      <div>
        Keep Ratio: <Checkbox checked={keetRatio} onChange={({ target }) => setKeepRatio(target.value)} />
      </div>
    </div>
  );
};
