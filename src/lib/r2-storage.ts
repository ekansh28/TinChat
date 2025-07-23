// src/lib/r2-storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// R2 Configuration - Updated with your correct details
const R2_CONFIG = {
  region: 'auto',
  endpoint: 'https://b39a7629b71eb941f04fbba075535cf4.eu.r2.cloudflarestorage.com', // Updated to EU endpoint
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
};

export const r2Client = new S3Client(R2_CONFIG);

export const BUCKET_NAME = 'tinchatfiles';

// File upload function
export async function uploadFileToR2(
  file: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'css-files'
): Promise<string> {
  try {
    const key = `${folder}/${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      // Remove ACL as R2 handles this differently
    });

    await r2Client.send(command);
    
    // Return the correct public URL using your Public Development URL
    return `https://pub-8cff6f1c23f942768d1416616d15d6f0.r2.dev/${key}`;
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    throw new Error('Failed to upload file');
  }
}

// File deletion function
export async function deleteFileFromR2(fileUrl: string): Promise<void> {
  try {
    // Extract the key from the URL
    const urlParts = fileUrl.split('/');
    const key = urlParts.slice(-2).join('/'); // folder/filename
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    throw new Error('Failed to delete file');
  }
}

// Utility function to generate unique file names
export function generateUniqueFileName(originalName: string, userId: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  return `${userId}-${timestamp}-${randomString}.${extension}`;
}

// Utility function to validate file types
export function validateFileType(fileName: string, allowedTypes: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? allowedTypes.includes(extension) : false;
}

// File size validation
export function validateFileSize(fileSize: number, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return fileSize <= maxSizeInBytes;
}