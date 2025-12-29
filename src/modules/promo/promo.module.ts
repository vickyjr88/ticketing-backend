import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromoCode } from '../../entities/promo-code.entity';
import { PromoCodeUsage } from '../../entities/promo-code-usage.entity';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';

@Module({
    imports: [TypeOrmModule.forFeature([PromoCode, PromoCodeUsage])],
    controllers: [PromoController],
    providers: [PromoService],
    exports: [PromoService],
})
export class PromoModule { }
