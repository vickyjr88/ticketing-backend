import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { S3Service } from '../../services/s3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { EventStatus } from '../../entities/event.entity';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private eventsService: EventsService,
    private s3Service: S3Service,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get all events' })
  @ApiQuery({ name: 'status', enum: EventStatus, required: false })
  async findAll(@Query('status') status?: EventStatus) {
    if (status) {
      return this.eventsService.findAll(status);
    }
    return this.eventsService.findPublished();
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-events')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user events' })
  async findMyEvents(@Req() req) {
    return this.eventsService.findByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  async findOne(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new event' })
  async create(@Body() createEventDto: CreateEventDto, @Req() req) {
    return this.eventsService.create(createEventDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }

  // Ticket Tier Management
  @Get(':id/tiers')
  @ApiOperation({ summary: 'Get ticket tiers for an event' })
  async getTiers(@Param('id') id: string) {
    return this.eventsService.getTiersGroupedByCategory(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/tiers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new ticket tier (Admin only)' })
  async createTier(
    @Param('id') id: string,
    @Body() createTierDto: CreateTierDto,
  ) {
    return this.eventsService.createTier(id, createTierDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/tiers/:tierId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update ticket tier (Admin only)' })
  async updateTier(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @Body() updateTierDto: UpdateTierDto,
  ) {
    return this.eventsService.updateTier(tierId, updateTierDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/tiers/:tierId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete ticket tier (Admin only)' })
  async deleteTier(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
  ) {
    return this.eventsService.deleteTier(tierId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/upload-image')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload event banner image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP are allowed');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Upload to S3
    const imageUrl = await this.s3Service.uploadEventImage(file, id);

    // Update event with new image URL
    await this.eventsService.updateEventImage(id, imageUrl);

    return {
      success: true,
      imageUrl,
      message: 'Image uploaded successfully',
    };
  }
}
