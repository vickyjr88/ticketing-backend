import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../../entities/media.entity';
import { S3Service } from '../../services/s3.service';

@Injectable()
export class MediaService {
    constructor(
        @InjectRepository(Media)
        private mediaRepository: Repository<Media>,
        private s3Service: S3Service,
    ) { }

    async findAll() {
        return this.mediaRepository.find({ order: { created_at: 'DESC' } });
    }

    async upload(file: Express.Multer.File) {
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
