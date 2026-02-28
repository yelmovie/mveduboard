import { supabase } from './client';
import { checkAndIncrementDailyQuota } from './quota';
import { IMAGE_OUTPUT_FORMAT } from '../../constants/limits';

const BUCKET_NAME = 'board-images';

export const buildImagePath = (schoolId: string, classId: string, postId: string, filename: string) => {
  return `school/${schoolId}/class/${classId}/posts/${postId}/images/${filename}`;
};

export const buildFilePath = (schoolId: string, classId: string, postId: string, filename: string) => {
  return `school/${schoolId}/class/${classId}/posts/${postId}/files/${filename}`;
};

const uploadImage = async ({
  blob,
  filename,
  schoolId,
  classId,
  postId,
}: {
  blob: Blob;
  filename: string;
  schoolId: string;
  classId: string;
  postId: string;
}) => {
  if (!supabase) {
    return { status: 'not_configured' as const };
  }

  const path = buildImagePath(schoolId, classId, postId, filename);
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, blob, {
    contentType: IMAGE_OUTPUT_FORMAT,
    upsert: false,
  });

  if (error) {
    return { status: 'upload_failed' as const, error };
  }

  return { status: 'uploaded' as const, path };
};

export const uploadImageWithQuota = async ({
  blob,
  filename,
  schoolId,
  classId,
  postId,
  userId,
}: {
  blob: Blob;
  filename: string;
  schoolId: string;
  classId: string;
  postId: string;
  userId: string;
}) => {
  if (!supabase) {
    return { status: 'not_configured' as const };
  }

  const quotaResult = await checkAndIncrementDailyQuota(userId);
  if (!quotaResult.allowed) {
    return { status: 'quota_blocked' as const, reason: quotaResult.reason };
  }

  return uploadImage({ blob, filename, schoolId, classId, postId });
};

export const uploadImageWithoutQuota = async ({
  blob,
  filename,
  schoolId,
  classId,
  postId,
}: {
  blob: Blob;
  filename: string;
  schoolId: string;
  classId: string;
  postId: string;
}) => {
  return uploadImage({ blob, filename, schoolId, classId, postId });
};

export const uploadFileWithoutQuota = async ({
  blob,
  filename,
  contentType,
  schoolId,
  classId,
  postId,
}: {
  blob: Blob;
  filename: string;
  contentType: string;
  schoolId: string;
  classId: string;
  postId: string;
}) => {
  if (!supabase) {
    return { status: 'not_configured' as const };
  }

  const path = buildFilePath(schoolId, classId, postId, filename);
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, blob, {
    contentType,
    upsert: false,
  });

  if (error) {
    return { status: 'upload_failed' as const, error };
  }

  return { status: 'uploaded' as const, path };
};

export const createSignedUrl = async (path: string, expiresSeconds = 60) => {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, expiresSeconds);
  if (error) return null;
  return data?.signedUrl || null;
};
