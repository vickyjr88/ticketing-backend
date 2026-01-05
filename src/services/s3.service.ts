import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);
    private s3Client: S3Client;
    private bucketName: string;
    private region: string;
    private cdnUrl: string;

    constructor() {
        this.region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1';
        this.bucketName = process.env.AWS_S3_BUCKET;
        this.cdnUrl = process.env.CDN_URL || process.env.AWS_S3_BUCKET_URL;

        if (!this.bucketName) {
            this.logger.warn('AWS_S3_BUCKET not configured. S3 uploads will fail.');
        }

        const s3Config: any = {
            region: this.region,
        };

        // Use explicit credentials if provided, otherwise fallback to IAM role/instance profile
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            s3Config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            };
            this.logger.log(`Using explicit AWS credentials from environment variables (Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...)`);
        } else {
            this.logger.warn('AWS credentials not found in environment. Using default AWS credential provider chain (IAM role/instance profile)');
        }

        this.s3Client = new S3Client(s3Config);

        this.logger.log(`S3 Service initialized. Bucket: ${this.bucketName}, Region: ${this.region}`);
    }

    /**
     * Upload event banner image to S3
     */
    async uploadEventImage(
        file: Express.Multer.File,
        eventId: string,
    ): Promise<string> {
        if (!this.bucketName) {
            throw new Error('S3 bucket not configured');
        }

        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const key = `events/${eventId}/banner/${fileName}`;

        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                CacheControl: 'max-age=31536000', // Cache for 1 year
                Metadata: {
                    eventId,
                    uploadedAt: new Date().toISOString(),
                },
            });

            await this.s3Client.send(command);

            const imageUrl = `${this.cdnUrl}/${key}`;
            this.logger.log(`Image uploaded successfully: ${imageUrl}`);

            return imageUrl;
        } catch (error) {
            this.logger.error(`Failed to upload image to S3: ${error.message}`, error.stack);
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }

    /**
     * Upload ticket tier image to S3
     */
    async uploadTierImage(
        file: Express.Multer.File,
        eventId: string,
        tierId: string,
    ): Promise<string> {
        if (!this.bucketName) {
            throw new Error('S3 bucket not configured');
        }

        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const key = `events/${eventId}/tiers/${tierId}/${fileName}`;

        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                CacheControl: 'max-age=31536000',
                Metadata: {
                    eventId,
                    tierId,
                    uploadedAt: new Date().toISOString(),
                },
            });

            await this.s3Client.send(command);

            const imageUrl = `${this.cdnUrl}/${key}`;
            this.logger.log(`Tier image uploaded successfully: ${imageUrl}`);

            return imageUrl;
        } catch (error) {
            this.logger.error(`Failed to upload tier image to S3: ${error.message}`, error.stack);
            throw new Error(`Failed to upload tier image: ${error.message}`);
        }
    }

    /**
     * Delete image from S3
     */
    async deleteImage(imageUrl: string): Promise<void> {
        if (!this.bucketName || !imageUrl) {
            return;
        }

        try {
            // Extract key from URL
            const urlParts = imageUrl.split('/');
            const keyIndex = urlParts.findIndex(part => part === 'events');
            if (keyIndex === -1) {
                this.logger.warn(`Invalid image URL format: ${imageUrl}`);
                return;
            }

            const key = urlParts.slice(keyIndex).join('/');

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
            this.logger.log(`Image deleted successfully: ${key}`);
        } catch (error) {
            this.logger.error(`Failed to delete image from S3: ${error.message}`, error.stack);
            // Don't throw error - deletion failure shouldn't block other operations
        }
    }

    /**
     * Upload generic media to S3
     */
    async uploadMedia(
        file: Express.Multer.File,
    ): Promise<{ url: string; key: string, filename: string, mimetype: string, size: number }> {
        if (!this.bucketName) {
            throw new Error('S3 bucket not configured');
        }

        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const key = `media/${fileName}`;

        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                CacheControl: 'max-age=31536000',
                Metadata: {
                    uploadedAt: new Date().toISOString(),
                    originalName: file.originalname
                },
            });

            await this.s3Client.send(command);

            const imageUrl = `${this.cdnUrl}/${key}`;
            this.logger.log(`Media uploaded successfully: ${imageUrl}`);

            return {
                url: imageUrl,
                key: key,
                filename: fileName,
                mimetype: file.mimetype,
                size: file.size
            };
        } catch (error) {
            this.logger.error(`Failed to upload media to S3: ${error.message}`, error.stack);
            throw new Error(`Failed to upload media: ${error.message}`);
        }
    }

    /**
     * Get S3 configuration info
     */
    getConfig() {
        return {
            bucketName: this.bucketName,
            region: this.region,
            cdnUrl: this.cdnUrl,
            isConfigured: !!this.bucketName,
        };
    }
}
