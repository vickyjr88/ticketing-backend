import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentConfig } from '../../entities/payment-config.entity';
import { PaymentProvider } from '../../entities/order.entity';

@Injectable()
export class PaymentSettingsService {
    constructor(
        @InjectRepository(PaymentConfig)
        private repo: Repository<PaymentConfig>,
    ) { }

    async getAllConfigs(): Promise<PaymentConfig[]> {
        return this.repo.find();
    }

    async getConfig(provider: PaymentProvider): Promise<PaymentConfig | null> {
        return this.repo.findOne({ where: { provider } });
    }

    async updateConfig(provider: PaymentProvider, data: Partial<PaymentConfig>): Promise<PaymentConfig> {
        let config = await this.repo.findOne({ where: { provider } });

        if (!config) {
            config = this.repo.create({ provider });
        }

        // Merge data
        if (data.is_enabled !== undefined) config.is_enabled = data.is_enabled;
        if (data.is_test_mode !== undefined) config.is_test_mode = data.is_test_mode;
        if (data.credentials) {
            config.credentials = { ...(config.credentials || {}), ...data.credentials };
        }

        return this.repo.save(config);
    }

    // Helper for services to get valid credentials
    async getEffectiveCredentials(provider: PaymentProvider): Promise<any> {
        const config = await this.getConfig(provider);
        if (!config || !config.is_enabled) {
            // Fallback to env vars? Or throw?
            // User wants "configurable via admin". If disabled in admin, it should effectively be disabled.
            // However, for backward compatibility, if no config exists in DB, we might want to default to ENV.
            // But the request implies moving control to Admin.
            // I'll return null if disabled or not found, let service decide (likely fallback to ENV if null).
            // Or if I want to enforce Admin control: If DB entry exists and disabled, return null.
            // If DB config exists and enabled, return keys.
            // If DB config does NOT exist, maybe checking ENV is safe default to avoid breaking current setup immediately.
            return null;
        }
        return config.credentials;
    }

    async getPublicConfigs(): Promise<{ provider: string; is_enabled: boolean; is_test_mode: boolean }[]> {
        const configs = await this.repo.find();
        return configs.map(c => ({
            provider: c.provider,
            is_enabled: c.is_enabled,
            is_test_mode: c.is_test_mode
        }));
    }
}
