import { Controller, Get, Post, Delete, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class MediaController {
    constructor(private readonly mediaService: MediaService) { }

    @Get()
    @ApiOperation({ summary: 'Get all media' })
    findAll() {
        return this.mediaService.findAll();
    }

    @Post()
    @ApiOperation({ summary: 'Upload media file' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    upload(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }
        return this.mediaService.upload(file);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete media file' })
    remove(@Param('id') id: string) {
        return this.mediaService.remove(id);
    }
}
