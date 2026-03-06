import {
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_WIDTH,
  IMAGE_OUTPUT_FORMAT,
  ALBUM_IMAGE_MAX_WIDTH,
  ALBUM_IMAGE_JPEG_QUALITY,
} from '../../constants/limits';

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지 미리보기를 생성할 수 없습니다.'));
    reader.readAsDataURL(blob);
  });

export type ResizeOptions = {
  maxWidth?: number;
  quality?: number;
};

export const resizeAndCompressImage = async (file: File, options?: ResizeOptions) => {
  const maxWidth = options?.maxWidth ?? IMAGE_MAX_WIDTH;
  const quality = options?.quality ?? IMAGE_JPEG_QUALITY;

  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지 처리 컨텍스트를 생성할 수 없습니다.');

  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('이미지 압축에 실패했습니다.'));
          return;
        }
        resolve(result);
      },
      IMAGE_OUTPUT_FORMAT,
      quality
    );
  });

  const previewUrl = await readAsDataUrl(blob);

  return {
    blob,
    previewUrl,
    width: targetWidth,
    height: targetHeight,
  };
};

/** 사진첩 일괄 업로드용: 자동 화질 개선·축소(해상도·용량)로 업로드 시간 단축 */
export const resizeAndCompressImageForAlbum = async (file: File) => {
  return resizeAndCompressImage(file, {
    maxWidth: ALBUM_IMAGE_MAX_WIDTH,
    quality: ALBUM_IMAGE_JPEG_QUALITY,
  });
};

// NOTE: EXIF 방향 정보는 브라우저 기본 API만으로 안정적으로 보정하기 어렵습니다.
