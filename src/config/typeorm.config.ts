import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: configService.get('DB_HOST') || 'localhost',
  port: parseInt(configService.get('DB_PORT')) || 5432,
  username: configService.get('DB_USERNAME') || 'postgres',
  password: configService.get('DB_PASSWORD') || 'postgres',
  database: configService.get('DB_NAME') || configService.get('DB_DATABASE') || 'ticketing_db',
  entities: [__dirname + '/../**/*.entity' + (__filename.endsWith('.js') ? '.js' : '{.ts,.js}')],
  migrations: [__dirname + '/../migrations/*' + (__filename.endsWith('.js') ? '.js' : '{.ts,.js}')],
  synchronize: false, // Use migrations instead
  logging: configService.get('NODE_ENV') === 'development',
  ssl: configService.get('NODE_ENV') === 'production'
    ? { rejectUnauthorized: false }
    : false,
};

const dataSource = new DataSource(typeOrmConfig);
export default dataSource;
