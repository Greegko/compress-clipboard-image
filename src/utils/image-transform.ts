import ImageTransformer, { MimeType } from "js-image-lib";
import { pipe } from "remeda";
import { createEffect, createSignal } from "solid-js";

export interface ConvertConfig {
  quality?: number;
  width?: number;
  height?: number;
}

export interface EditorSettings {
  quality: number;
  width: number;
  height: number;
  isCropEnabled?: boolean;
}

export type Dimensions = { height: number; width: number };

export interface ImageMetadata {
  width: number;
  height: number;
}

export type CropSelection = [[number, number], [number, number]];

export function useImageTransform() {
  const [originalImage, setOriginalImage] = createSignal<File | null>(null);
  const [originalImageMetadata, setOriginalImageMetadata] = createSignal<ImageMetadata | null>(null);
  const [alteredImage, setAlteredImage] = createSignal<Blob | null>(null);
  const [editorSettings, setEditorSettings] = createSignal<EditorSettings>({ quality: 50, width: 0, height: 0 });
  const [cropSelection, setCropSelection] = createSignal<CropSelection | null>();
  const [imageDisplayRatio, setImageDisplayRatio] = createSignal<number>(0);

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

  const getFileDimensions = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const imageTransformer = new ImageTransformer(new Uint8Array(buffer));
    const { height, width } = imageTransformer;
    return { height, width };
  };

  createEffect(async () => {
    if (!originalImage()) return;
    if (cropSelection()) return;

    const { height, width } = await getFileDimensions(originalImage());

    setEditorSettings(settings => ({
      ...settings,
      height,
      width,
    }));

    setOriginalImageMetadata({ height, width });
  });

  const toImageTransformer = async (file: File) => {
    const buffer = await file.arrayBuffer();
    return new ImageTransformer(new Uint8Array(buffer));
  };

  const resize = (imageTransformer: ImageTransformer, config: ConvertConfig) => {
    if (config.width && config.height) {
      imageTransformer.resize(config.width, config.height);
    }

    imageTransformer.outputOptions.quality = config.quality;

    return imageTransformer;
  };

  const setQuality = (imageTransformer: ImageTransformer, config: ConvertConfig) => {
    imageTransformer.outputOptions.quality = config.quality;

    return imageTransformer;
  };

  const cropImage = (imageTransformer: ImageTransformer, cropping: CropSelection, displayRatio: number) => {
    const [[x, y], [width, height]] = cropping;

    const [newX, newWidth] = [x, width].map(x => x * displayRatio).map(Math.round);
    const [newY, newHeight] = [y, height].map(x => x * displayRatio).map(Math.round);

    imageTransformer.crop(newX, newY, imageTransformer.width, imageTransformer.height);
    imageTransformer.crop(0, 0, newWidth, newHeight);

    return imageTransformer;
  };

  const toJpegFile = (imageTransformer: ImageTransformer) => {
    return new Blob([imageTransformer.toBuffer(MimeType.JPEG)], { type: "image/jpeg" });
  };

  createEffect(async () => {
    if (!originalImage()) return;

    const editorSettingsVal = editorSettings();
    const image = originalImage();
    const cropSelectionVal = cropSelection();
    const imageRatio = 1 / imageDisplayRatio();

    pipe(
      await toImageTransformer(image),
      it => {
        if (cropSelection()) {
          return cropImage(it, cropSelectionVal, imageRatio);
        }

        return it;
      },
      it => resize(it, editorSettingsVal),
      it => setQuality(it, editorSettingsVal),
      it => toJpegFile(it),
      jpeg => setAlteredImage(jpeg),
    );
  });

  const download = (content: Blob, filename: string) => {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const quickConvertAndDownload = async (file: File) => {
    const fileDimensions = await getFileDimensions(file);

    pipe(
      await toImageTransformer(file),
      it => resize(it, calculateThumbnail(fileDimensions, 1024)),
      it => setQuality(it, { quality: 50 }),
      it => toJpegFile(it),
      jpeg => download(jpeg, file.name),
    );
  };

  return {
    originalImage,
    originalImageMetadata,
    alteredImage,
    editorSettings,
    setEditorSettings,
    cropSelection,
    setCropSelection,
    imageDisplayRatio,
    setOriginalImage,
    setImageDisplayRatio,
  };
}

export const resizeDimension = (dimensions: Dimensions, newDimensions: Partial<Dimensions>): Dimensions => {
  if (newDimensions.height) {
    return {
      height: newDimensions.height,
      width: Math.ceil((newDimensions.height / dimensions.height) * dimensions.width),
    };
  }

  if (newDimensions.width) {
    return {
      width: newDimensions.width,
      height: Math.ceil((newDimensions.width / dimensions.width) * dimensions.height),
    };
  }
};

export const calculateThumbnail = (dimensions: Dimensions, size: number) => {
  if (dimensions.height > size) {
    dimensions = resizeDimension(dimensions, { height: size });
  }

  if (dimensions.width > size) {
    dimensions = resizeDimension(dimensions, { width: size });
  }

  return dimensions;
};
