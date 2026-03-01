/** DEPRECATED: 사용처 없음. 앱은 src/lib/image/resizeCompress.ts 사용. */
import { IMAGE_MAX_WIDTH, IMAGE_OUTPUT_FORMAT, IMAGE_JPEG_QUALITY } from '../../constants/limits';

const readFileAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지 미리보기 생성에 실패했습니다.'));
    reader.readAsDataURL(blob);
  });

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 변환에 실패했습니다.'));
          return;
        }
        resolve(blob);
      },
      IMAGE_OUTPUT_FORMAT,
      IMAGE_JPEG_QUALITY
    );
  });

export const resizeCompressImage = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  // EXIF 회전 정보는 브라우저 기본 렌더링에 의존합니다.
  const img = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_WIDTH / img.width);
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('이미지 처리에 실패했습니다.');
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await canvasToBlob(canvas);
  const dataUrl = await readFileAsDataUrl(blob);
  return { blob, dataUrl, width: targetWidth, height: targetHeight };
};
