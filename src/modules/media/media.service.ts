import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../../entities/media.entity';
import { S3Service } from '../../services/s3.service';
import { PaginatedResult, createPaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class MediaService {
    constructor(
        @InjectRepository(Media)
        private mediaRepository: Repository<Media>,
        private s3Service: S3Service,
    ) { }

    async findAll(page: number = 1, limit: number = 24): Promise<PaginatedResult<Media>> {
        const [data, total] = await this.mediaRepository.findAndCount({
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return createPaginatedResult(data, total, page, limit);
    }

    async upload(file: Express.Multer.File) {
        // Check if S3 is configured
        const s3Config = this.s3Service.getConfig();
        if (!s3Config.isConfigured) {
            throw new BadRequestException(
                'Media upload is not configured. Please set AWS_S3_BUCKET in environment variables.'
            );
        }

        const uploadResult = await this.s3Service.uploadMedia(file);

        const media = this.mediaRepository.create({
            url: uploadResult.url,
            key: uploadResult.key,
            filename: uploadResult.filename,
            mimetype: uploadResult.mimetype,
            size: uploadResult.size,
        });

        return this.mediaRepository.save(media);
    }

    async remove(id: string) {
        const media = await this.mediaRepository.findOne({ where: { id } });
        if (!media) {
            throw new NotFoundException('Media not found');
        }

        // Delete from S3
        await this.s3Service.deleteImage(media.url);

        return this.mediaRepository.remove(media);
    }
}
