import { Button, Checkbox, Input, InputNumber, Select } from "antd";
import ImageTransformer, { MimeType } from "js-image-lib";
import { last, once } from "lodash-es";
import debounce from "lodash-es/debounce";
import { DragEventHandler, MouseEventHandler, createRef, useCallback, useEffect, useState } from "react";

import { formatBytes } from "./utils/format-bytes";
import { hookImagePaste } from "./utils/paste-image";

interface EditorSettings {
  quality: number;
  width: number;
  height: number;
  isCropEnabled?: boolean;
}

interface ImageMetadata {
  width: number;
  height: number;
}

type CropSelection = [[number, number], [number, number]];

export const App = () => {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImageMetadata, setOriginalImageMetadata] = useState<ImageMetadata | null>(null);
  const [alteredImage, setAlteredImage] = useState<Blob | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({ quality: 50, width: 0, height: 0 });
  const [cropSelection, setCropSelection] = useState<CropSelection | null>();
  const [imageDisplayRatio, setImageDisplayRatio] = useState<number>(0);

  useEffect(() => {
    hookImagePaste(file => setOriginalImage(file));
  }, []);

  useEffect(() => {
    if (!imageDisplayRatio) return;
    if (!cropSelection) return;

    const ratio = 1 / imageDisplayRatio;

    const width = Math.round(cropSelection[1][0] * ratio);
    const height = Math.round(cropSelection[1][1] * ratio);

    setEditorSettings(settings => ({
      ...settings,
      width,
      height,
    }));

    setOriginalImageMetadata({ width, height });
  }, [cropSelection, imageDisplayRatio]);

  useEffect(() => {
    if (!originalImage) return;
    if (cropSelection) return;

    originalImage
      .arrayBuffer()
      .then(arrBuff => new ImageTransformer(new Uint8Array(arrBuff)))
      .then(transformer => {
        const { height, width } = transformer;
        setEditorSettings(settings => ({
          ...settings,
          height,
          width,
        }));

        setOriginalImageMetadata({ height, width });
      });
  }, [originalImage, cropSelection]);

  useEffect(() => {
    if (!originalImage) return;

    originalImage
      .arrayBuffer()
      .then(arrBuff => new ImageTransformer(new Uint8Array(arrBuff)))
      .then(transformer => {
        const displayRatio = 1 / imageDisplayRatio;

        if (cropSelection) {
          const [[x, y], [width, height]] = cropSelection;

          const [newX, newWidth] = [x, width].map(x => x * displayRatio).map(Math.round);
          const [newY, newHeight] = [y, height].map(x => x * displayRatio).map(Math.round);

          transformer.crop(newX, newY, transformer.width, transformer.height);
          transformer.crop(0, 0, newWidth, newHeight);
        }

        if (editorSettings.width && editorSettings.height) {
          transformer.resize(editorSettings.width, editorSettings.height);
        }

        transformer.outputOptions.quality = editorSettings.quality;

        setAlteredImage(new Blob([transformer.toBuffer(MimeType.JPEG)], { type: "image/jpeg" }));
      });
  }, [editorSettings, originalImage, cropSelection]);

  const onDragAndDrop: DragEventHandler<HTMLDivElement> = useCallback(e => {
    if (last(e.dataTransfer.files)) setOriginalImage(last(e.dataTransfer.files)!);

    e.preventDefault();
    return false;
  }, []);

  return (
    <div style={{ display: "flex", height: "100%" }} onDrop={onDragAndDrop} onDragOver={onDragAndDrop}>
      <div style={{ flex: "1" }}>
        <h2>Original Image</h2>
        {originalImage && originalImageMetadata && (
          <>
            <div>
              File Size: {formatBytes(originalImage.size)} w: {originalImageMetadata.width}px h:
              {originalImageMetadata.height}px
            </div>
            <Cropping setCropSelection={setCropSelection}>
              <DisplayImage setOverlay={true} image={originalImage} setImageDisplayRatio={setImageDisplayRatio} />
            </Cropping>
          </>
        )}
      </div>

      <Editor
        imageMetadata={originalImageMetadata}
        editorSettings={editorSettings}
        onEditorSettingsChanged={settings => setEditorSettings(settings)}
      />

      <div style={{ flex: "1" }}>
        <h2>Transformed Image</h2>
        {alteredImage && <div>File Size: {formatBytes(alteredImage.size)}</div>}
        {alteredImage && <DisplayImage image={alteredImage} />}
      </div>
    </div>
  );
};

const DisplayImage = ({
  image,
  setOverlay,
  setImageDisplayRatio,
}: {
  image: File | Blob;
  setOverlay?: boolean;
  setImageDisplayRatio?: (val: number) => void;
}) => {
  const [overlaySize, setOverlaySize] = useState<[number, number] | null>();
  const imageRef = createRef<HTMLImageElement>();

  useEffect(() => {
    if (!imageRef.current) return;

    imageRef.current.onload = once(e => {
      setImageDisplayRatio?.(e.target.width / e.target.naturalWidth);
      setOverlaySize([e.target.width, e.target.height]);
    });
  }, [imageRef.current]);

  return (
    <div>
      {setOverlay && overlaySize && (
        <div style={{ position: "absolute", width: overlaySize[0], height: overlaySize[1], userSelect: "none" }}></div>
      )}
      <img ref={imageRef} src={URL.createObjectURL(image)} style={{ maxHeight: "75vh", maxWidth: "40vw" }} />
    </div>
  );
};

interface EditorProperties {
  editorSettings: EditorSettings;
  imageMetadata: ImageMetadata | null;
  onEditorSettingsChanged: (settings: EditorSettings) => void;
}

const Editor = ({ imageMetadata, editorSettings, onEditorSettingsChanged }: EditorProperties) => {
  const [keetRatio, setKeepRatio] = useState<boolean>(true);

  const updateHeightWidth = useCallback(
    debounce(({ height, width }: { height?: number | null; width?: number | null }) => {
      if (height) {
        if (keetRatio)
          onEditorSettingsChanged({
            ...editorSettings,
            height,
            width: Math.ceil((height / editorSettings.height) * editorSettings.width),
          });
        if (!keetRatio) onEditorSettingsChanged({ ...editorSettings, height });
      }

      if (width) {
        if (keetRatio)
          onEditorSettingsChanged({
            ...editorSettings,
            height: Math.ceil((width / editorSettings.width) * editorSettings.height),
            width,
            quality: editorSettings.quality,
          });
        if (!keetRatio) onEditorSettingsChanged({ ...editorSettings, width });
      }
    }, 300),
    [editorSettings, keetRatio],
  );

  const setThumbnail = useCallback(
    debounce(size => {
      if (!imageMetadata) return;

      setKeepRatio(true);
      if (imageMetadata.height > imageMetadata.width) {
        updateHeightWidth({ height: Math.min(size, imageMetadata.height) });
      } else {
        updateHeightWidth({ width: Math.min(size, imageMetadata.width) });
      }
    }),
    [imageMetadata],
  );

  const reset = useCallback(() => {
    if (!imageMetadata) return;

    setKeepRatio(true);
    updateHeightWidth({ width: imageMetadata.width, height: imageMetadata.height });
  }, [imageMetadata]);

  return (
    <div style={{ width: 350 }}>
      <h2>Manipulator settings</h2>
      <h3>Optimalize</h3>
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
        onChange={quality => onEditorSettingsChanged({ ...editorSettings, quality })}
      />
      <h3>Resize</h3>
      <div>
        <Button style={{ marginRight: "5px" }} onClick={reset}>
          Original
        </Button>
        <Button onClick={() => setThumbnail(1024)}>Thumbnail (1024px)</Button>
      </div>
      <br />
      <div>
        Width:{" "}
        <InputNumber size="small" value={editorSettings.width} onChange={width => updateHeightWidth({ width })} />{" "}
        Height:{" "}
        <InputNumber size="small" value={editorSettings.height} onChange={height => updateHeightWidth({ height })} />
      </div>
      <div>
        Keep Ratio: <Checkbox checked={keetRatio} onChange={({ target }) => setKeepRatio(target.value)} />
      </div>
    </div>
  );
};

const Cropping = ({
  children,
  setCropSelection: setCropSelectionOutput,
}: {
  children: JSX.Element;
  setCropSelection: (area: CropSelection | null) => void;
}) => {
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
  const [cropSelectionActive, setCropSelectionActive] = useState(false);

  const onCroppingStart: MouseEventHandler<HTMLSpanElement> = useCallback(e => {
    setCropSelectionActive(true);

    setCropSelection([
      [e.nativeEvent.offsetX, e.nativeEvent.offsetY],
      [0, 0],
    ]);
  }, []);

  useEffect(() => {
    if (!cropSelectionActive) setCropSelectionOutput(cropSelection);
  }, [cropSelection, cropSelectionActive]);

  const onCroppingMove: MouseEventHandler<HTMLSpanElement> = useCallback(
    e => {
      if (!cropSelectionActive) return;

      setCropSelection(area => {
        if (!area) return null;

        const [x, y] = area[0];

        const [newWidth, newHeight] = [e.nativeEvent.offsetX - x, e.nativeEvent.offsetY - y];

        return [
          [x, y],
          [newWidth, newHeight],
        ];
      });
    },
    [cropSelectionActive],
  );

  const onCroppingDone: MouseEventHandler<HTMLSpanElement> = useCallback(() => {
    setCropSelection(area => {
      if (!area) return null;

      let [x, y] = area[0];
      let [width, height] = area[1];

      if (width < 0) {
        x += width;
        width = -width;
      }

      if (height < 0) {
        y += height;
        height = -height;
      }

      if (width < 5 && height < 5) return null;

      return [
        [x, y],
        [width, height],
      ];
    });

    setCropSelectionActive(false);
  }, []);

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseDown={onCroppingStart}
      onMouseMove={onCroppingMove}
      onMouseUp={onCroppingDone}
    >
      {cropSelection && (
        <div
          className="crop-area"
          style={{
            position: "absolute",
            left: cropSelection[0][0] + "px",
            top: cropSelection[0][1] + "px",
            width: Math.abs(cropSelection[1][0]) + "px",
            height: Math.abs(cropSelection[1][1]) + "px",
            transform: `translate(${cropSelection[1][0] < 0 ? "-100%" : "0%"}, ${
              cropSelection[1][1] < 0 ? "-100%" : "0%"
            })`,
            border: "2px dashed black",
          }}
        ></div>
      )}
      {children}
    </div>
  );
};
