import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateGateDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class UpdateGateDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class AssignGateToEventDto {
    @IsUUID()
    gate_id: string;

    @IsUUID()
    event_id: string;

    @IsOptional()
    @IsUUID()
    scanner_id?: string;
}

export class AssignScannerDto {
    @IsUUID()
    scanner_id: string;
}

export class BulkAssignGatesDto {
    @IsUUID()
    event_id: string;

    @IsUUID('4', { each: true })
    gate_ids: string[];
}
