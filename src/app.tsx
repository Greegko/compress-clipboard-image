import ImageTransformer, { MimeType } from "js-image-lib";
import { Show, createEffect, createSignal } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

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
  const [originalImage, setOriginalImage] = createSignal<File | null>(null);
  const [originalImageMetadata, setOriginalImageMetadata] = createSignal<ImageMetadata | null>(null);
  const [alteredImage, setAlteredImage] = createSignal<Blob | null>(null);
  const [editorSettings, setEditorSettings] = createSignal<EditorSettings>({ quality: 50, width: 0, height: 0 });
  const [cropSelection, setCropSelection] = createSignal<CropSelection | null>();
  const [imageDisplayRatio, setImageDisplayRatio] = createSignal<number>(0);

  createEffect(() => hookImagePaste(file => setOriginalImage(file)));

  createEffect(() => {
    if (!imageDisplayRatio()) return;
    if (!cropSelection()) return;

    const ratio = 1 / imageDisplayRatio();

    const width = Math.round(cropSelection()[1][0] * ratio);
    const height = Math.round(cropSelection()[1][1] * ratio);

    setEditorSettings(settings => ({
      ...settings,
      width,
      height,
    }));

    setOriginalImageMetadata({ width, height });
  });

  createEffect(() => {
    if (!originalImage()) return;
    if (cropSelection()) return;

    originalImage()
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
  });

  createEffect(() => {
    if (!originalImage()) return;

    const cropSelectionVal = cropSelection();
    const editorSetting = editorSettings();

    originalImage()
      .arrayBuffer()
      .then(arrBuff => new ImageTransformer(new Uint8Array(arrBuff)))
      .then(transformer => {
        const displayRatio = 1 / imageDisplayRatio();

        if (cropSelectionVal) {
          const [[x, y], [width, height]] = cropSelectionVal;

          const [newX, newWidth] = [x, width].map(x => x * displayRatio).map(Math.round);
          const [newY, newHeight] = [y, height].map(x => x * displayRatio).map(Math.round);

          transformer.crop(newX, newY, transformer.width, transformer.height);
          transformer.crop(0, 0, newWidth, newHeight);
        }

        if (editorSetting.width && editorSetting.height) {
          transformer.resize(editorSetting.width, editorSetting.height);
        }

        transformer.outputOptions.quality = editorSetting.quality;

        setAlteredImage(new Blob([transformer.toBuffer(MimeType.JPEG)], { type: "image/jpeg" }));
      });
  });

  const onDragAndDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      [...e.dataTransfer.items].forEach(item => {
        setOriginalImage(item.getAsFile());
      });
    }

    return false;
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  return (
    <div style={{ display: "flex", height: "100%" }} onDrop={onDragAndDrop} onDragOver={onDragOver}>
      <div style={{ flex: "1" }}>
        <h2>Original Image</h2>
        <Show when={originalImage() && originalImageMetadata()}>
          <div>
            File Size: {formatBytes(originalImage().size)} w: {originalImageMetadata().width}px h:
            {originalImageMetadata().height}px
          </div>
          <Cropping setCropSelection={setCropSelection}>
            <DisplayImage setOverlay={true} image={originalImage()} setImageDisplayRatio={setImageDisplayRatio} />
          </Cropping>
        </Show>
      </div>

      <Editor
        imageMetadata={originalImageMetadata()}
        editorSettings={editorSettings()}
        onEditorSettingsChanged={settings => setEditorSettings(settings)}
      />

      <div style={{ flex: "1" }}>
        <h2>Transformed Image</h2>
        <Show when={alteredImage()}>
          <div>File Size: {formatBytes(alteredImage().size)}</div>
          <DisplayImage image={alteredImage()} />
        </Show>
      </div>
    </div>
  );
};

interface DisplayImageProps {
  image: File | Blob;
  setOverlay?: boolean;
  setImageDisplayRatio?: (val: number) => void;
}

const DisplayImage = (props: DisplayImageProps) => {
  const [overlaySize, setOverlaySize] = createSignal<[number, number] | null>();

  let imageRef: HTMLImageElement;

  createEffect(() => {
    if (!imageRef) return;

    imageRef.onload = (e: any) => {
      props.setImageDisplayRatio?.(e.target.width / e.target.naturalWidth);
      setOverlaySize([e.target.width, e.target.height]);
    };
  });

  return (
    <div>
      <Show when={props.setOverlay && overlaySize()} keyed>
        {overlaySize => (
          <div
            style={{
              position: "absolute",
              width: overlaySize[0] + "px",
              height: overlaySize[1] + "px",
              "user-select": "none",
            }}
          ></div>
        )}
      </Show>
      <img
        ref={imageRef}
        src={URL.createObjectURL(props.image)}
        style={{ "max-height": "75vh", "max-width": "40vw" }}
      />
    </div>
  );
};

interface EditorProperties {
  editorSettings: EditorSettings;
  imageMetadata: ImageMetadata | null;
  onEditorSettingsChanged: (settings: EditorSettings) => void;
}

const Editor = (props: EditorProperties) => {
  const [keetRatio, setKeepRatio] = createSignal<boolean>(true);

  const updateHeightWidth = ({ height, width }: { height?: number | null; width?: number | null }) => {
    if (height) {
      if (keetRatio())
        props.onEditorSettingsChanged({
          ...props.editorSettings,
          height,
          width: Math.ceil((height / props.editorSettings.height) * props.editorSettings.width),
        });
      if (!keetRatio()) props.onEditorSettingsChanged({ ...props.editorSettings, height });
    }

    if (width) {
      if (keetRatio())
        props.onEditorSettingsChanged({
          ...props.editorSettings,
          height: Math.ceil((width / props.editorSettings.width) * props.editorSettings.height),
          width,
          quality: props.editorSettings.quality,
        });
      if (!keetRatio()) props.onEditorSettingsChanged({ ...props.editorSettings, width });
    }
  };

  const setThumbnail = size => {
    if (!props.imageMetadata) return;

    setKeepRatio(true);
    if (props.imageMetadata.height > props.imageMetadata.width) {
      updateHeightWidth({ height: Math.min(size, props.imageMetadata.height) });
    } else {
      updateHeightWidth({ width: Math.min(size, props.imageMetadata.width) });
    }
  };

  const reset = () => {
    if (!props.imageMetadata) return;

    setKeepRatio(true);
    updateHeightWidth({ width: props.imageMetadata.width, height: props.imageMetadata.height });
  };

  return (
    <div style={{ width: "350px" }}>
      <div class="text-2xl my-2">Manipulator settings</div>
      <div class="text-xl my-2">Optimalize</div>
      Quality:{" "}
      <select
        class="py-1 px-2 border border-sky-50 rounded mr-2"
        style={{ width: 120 + "px" }}
        value={props.editorSettings.quality}
        onChange={target =>
          props.onEditorSettingsChanged({ ...props.editorSettings, quality: parseInt(target.target.value) })
        }
      >
        <option value={100}>100</option>
        <option value={92}>92</option>
        <option value={85}>85</option>
        <option value={50}>50</option>
      </select>
      <div class="text-xl my-2">Resize</div>
      <div>
        <button class="py-1 px-3 border border-sky-50 rounded mr-2" onClick={reset}>
          Original
        </button>
        <button class="py-1 px-3 border border-sky-50 rounded" onClick={() => setThumbnail(1024)}>
          Thumbnail (1024px)
        </button>
      </div>
      <div class="mt-2">
        Width:{" "}
        <input
          class="py-1 px-2 border border-sky-50 rounded mr-2 w-20"
          type="number"
          size="small"
          value={props.editorSettings.width}
          onChange={target => updateHeightWidth({ width: parseInt(target.target.value) })}
        />{" "}
        Height:{" "}
        <input
          class="py-1 px-2 border border-sky-50 rounded mr-2  w-20"
          size="small"
          type="number"
          value={props.editorSettings.height}
          onChange={target => updateHeightWidth({ height: parseInt(target.target.value) })}
        />
      </div>
      <div class="mt-2">
        Keep Ratio:{" "}
        <input
          class="py-1 px-2 border border-sky-50 rounded mr-2"
          type="checkbox"
          checked={keetRatio()}
          onChange={target => setKeepRatio(target.target.checked)}
        />
      </div>
    </div>
  );
};

interface CroppingProps {
  children: JSX.Element;
  setCropSelection: (area: CropSelection | null) => void;
}

const Cropping = (props: CroppingProps) => {
  const [cropSelection, setCropSelection] = createSignal<CropSelection | null>(null);
  const [cropSelectionActive, setCropSelectionActive] = createSignal(false);

  const onCroppingStart = e => {
    setCropSelectionActive(true);

    setCropSelection([
      [e.offsetX, e.offsetY],
      [0, 0],
    ]);
  };

  createEffect(() => {
    if (!cropSelectionActive()) props.setCropSelection(cropSelection());
  });

  const onCroppingMove = e => {
    if (!cropSelectionActive()) return;

    setCropSelection(area => {
      if (!area) return null;

      const [x, y] = area[0];

      const [newWidth, newHeight] = [e.offsetX - x, e.offsetY - y];

      return [
        [x, y],
        [newWidth, newHeight],
      ];
    });
  };

  const onCroppingDone = () => {
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
  };

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseDown={onCroppingStart}
      onMouseMove={onCroppingMove}
      onMouseUp={onCroppingDone}
    >
      <Show when={cropSelection()} keyed>
        {cropSelection => (
          <div
            class="crop-area"
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
      </Show>
      {props.children}
    </div>
  );
};
