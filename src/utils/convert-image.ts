import ImageTransformer, { MimeType } from "js-image-lib";
import { pipe } from "remeda";

export interface ConvertConfig {
  quality?: number;
  width?: number;
  height?: number;
  crop?: CropSelection;
  displayRatio?: number;
}

export type Dimensions = { height: number; width: number };

export type CropSelection = [[number, number], [number, number]];

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

const cropImage = (imageTransformer: ImageTransformer, config: ConvertConfig) => {
  const [[x, y], [width, height]] = config.crop;

  const [newX, newWidth] = [x, width].map(x => x * config.displayRatio).map(Math.round);
  const [newY, newHeight] = [y, height].map(x => x * config.displayRatio).map(Math.round);

  imageTransformer.crop(newX, newY, imageTransformer.width, imageTransformer.height);
  imageTransformer.crop(0, 0, newWidth, newHeight);

  return imageTransformer;
};

const toJpegFile = (imageTransformer: ImageTransformer) => {
  return new Blob([imageTransformer.toBuffer(MimeType.JPEG)], { type: "image/jpeg" });
};

export const convertImage = async (image: File, config: ConvertConfig) => {
  return pipe(
    await toImageTransformer(image),
    it => {
      if (config.crop) {
        return cropImage(it, config);
      }

      return it;
    },
    it => resize(it, config),
    it => setQuality(it, config),
    it => toJpegFile(it),
  );
};

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

export const getFileDimensions = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const imageTransformer = new ImageTransformer(new Uint8Array(buffer));
  const { height, width } = imageTransformer;
  return { height, width };
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
