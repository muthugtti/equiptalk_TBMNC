import { Storage } from '@google-cloud/storage';

const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'default-bucket';

export const bucket = storage.bucket(bucketName);

export async function uploadFile(
    filePath: string,
    destination: string,
    contentType: string
) {
    await bucket.upload(filePath, {
        destination,
        metadata: {
            contentType,
        },
    });
}
