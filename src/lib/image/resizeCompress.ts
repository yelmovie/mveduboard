import { IMAGE_JPEG_QUALITY, IMAGE_MAX_WIDTH, IMAGE_OUTPUT_FORMAT } from '../../constants/limits';

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지 미리보기를 생성할 수 없습니다.'));
    reader.readAsDataURL(blob);
  });

export const resizeAndCompressImage = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > IMAGE_MAX_WIDTH ? IMAGE_MAX_WIDTH / bitmap.width : 1;
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
      IMAGE_JPEG_QUALITY
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

// NOTE: EXIF 방향 정보는 브라우저 기본 API만으로 안정적으로 보정하기 어렵습니다.
