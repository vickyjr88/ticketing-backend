import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
    constructor(
        @InjectRepository(Product)
        private productsRepository: Repository<Product>,
    ) { }

    async create(createProductDto: CreateProductDto): Promise<Product> {
        const { eventId, imageUrl, ...rest } = createProductDto;
        const product = this.productsRepository.create({
            ...rest,
            event_id: eventId,
            image_url: imageUrl,
        });
        return this.productsRepository.save(product);
    }

    async findAllByEvent(eventId: string): Promise<Product[]> {
        return this.productsRepository.find({
            where: { event_id: eventId, active: true },
        });
    }

    async findOne(id: string): Promise<Product> {
        const product = await this.productsRepository.findOne({ where: { id } });
        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }
        return product;
    }

    async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
        const { eventId, imageUrl, ...rest } = updateProductDto;
        const updateData: any = { ...rest };

        // Only update if provided
        if (eventId) updateData.event_id = eventId;
        if (imageUrl) updateData.image_url = imageUrl;

        await this.productsRepository.update(id, updateData);
        return this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        const product = await this.findOne(id);
        await this.productsRepository.remove(product);
    }
}
