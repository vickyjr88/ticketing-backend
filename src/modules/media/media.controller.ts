import { Controller, Get, Post, Delete, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
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
    @ApiOperation({ summary: 'Get all media with pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number,
    ) {
        return this.mediaService.findAll(page, limit);
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
