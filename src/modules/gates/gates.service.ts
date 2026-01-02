import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Gate } from '../../entities/gate.entity';
import { GateAssignment } from '../../entities/gate-assignment.entity';
import { Event } from '../../entities/event.entity';
import { User, UserRole } from '../../entities/user.entity';
import {
    CreateGateDto,
    UpdateGateDto,
    AssignGateToEventDto,
    BulkAssignGatesDto,
} from './dto/gate.dto';

@Injectable()
export class GatesService {
    constructor(
        @InjectRepository(Gate)
        private gatesRepository: Repository<Gate>,
        @InjectRepository(GateAssignment)
        private assignmentsRepository: Repository<GateAssignment>,
        @InjectRepository(Event)
        private eventsRepository: Repository<Event>,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    // ==================== GATE CRUD ====================

    async createGate(createGateDto: CreateGateDto): Promise<Gate> {
        const gate = this.gatesRepository.create(createGateDto);
        return this.gatesRepository.save(gate);
    }

    async getAllGates(includeInactive = false): Promise<Gate[]> {
        const where = includeInactive ? {} : { is_active: true };
        return this.gatesRepository.find({
            where,
            order: { name: 'ASC' },
        });
    }

    async getGate(id: string): Promise<Gate> {
        const gate = await this.gatesRepository.findOne({
            where: { id },
            relations: ['assignments', 'assignments.event', 'assignments.scanner'],
        });
        if (!gate) {
            throw new NotFoundException('Gate not found');
        }
        return gate;
    }

    async updateGate(id: string, updateGateDto: UpdateGateDto): Promise<Gate> {
        const gate = await this.gatesRepository.findOne({ where: { id } });
        if (!gate) {
            throw new NotFoundException('Gate not found');
        }
        Object.assign(gate, updateGateDto);
        return this.gatesRepository.save(gate);
    }

    async deleteGate(id: string): Promise<void> {
        const result = await this.gatesRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Gate not found');
        }
    }

    // ==================== GATE ASSIGNMENTS ====================

    async assignGateToEvent(dto: AssignGateToEventDto): Promise<GateAssignment> {
        // Validate gate exists
        const gate = await this.gatesRepository.findOne({
            where: { id: dto.gate_id },
        });
        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        // Validate event exists
        const event = await this.eventsRepository.findOne({
            where: { id: dto.event_id },
        });
        if (!event) {
            throw new NotFoundException('Event not found');
        }

        // Check if assignment already exists
        const existingAssignment = await this.assignmentsRepository.findOne({
            where: { gate_id: dto.gate_id, event_id: dto.event_id },
        });
        if (existingAssignment) {
            throw new ConflictException(
                'This gate is already assigned to this event',
            );
        }

        // Validate scanner if provided
        if (dto.scanner_id) {
            const scanner = await this.usersRepository.findOne({
                where: { id: dto.scanner_id, role: UserRole.SCANNER },
            });
            if (!scanner) {
                throw new BadRequestException('Invalid scanner or user is not a scanner');
            }
        }

        const assignment = this.assignmentsRepository.create(dto);
        return this.assignmentsRepository.save(assignment);
    }

    async bulkAssignGatesToEvent(dto: BulkAssignGatesDto): Promise<GateAssignment[]> {
        const { event_id, gate_ids } = dto;

        // Validate event exists
        const event = await this.eventsRepository.findOne({
            where: { id: event_id },
        });
        if (!event) {
            throw new NotFoundException('Event not found');
        }

        // Validate all gates exist
        const gates = await this.gatesRepository.find({
            where: { id: In(gate_ids), is_active: true },
        });
        if (gates.length !== gate_ids.length) {
            throw new BadRequestException('One or more gates not found or inactive');
        }

        // Get existing assignments
        const existingAssignments = await this.assignmentsRepository.find({
            where: { event_id, gate_id: In(gate_ids) },
        });
        const existingGateIds = new Set(existingAssignments.map((a) => a.gate_id));

        // Create new assignments for gates not already assigned
        const newAssignments = gate_ids
            .filter((gate_id) => !existingGateIds.has(gate_id))
            .map((gate_id) =>
                this.assignmentsRepository.create({ gate_id, event_id }),
            );

        if (newAssignments.length > 0) {
            await this.assignmentsRepository.save(newAssignments);
        }

        // Return all assignments for this event
        return this.getEventGates(event_id);
    }

    async getEventGates(eventId: string): Promise<GateAssignment[]> {
        return this.assignmentsRepository.find({
            where: { event_id: eventId },
            relations: ['gate', 'scanner'],
            order: { gate: { name: 'ASC' } },
        });
    }

    async removeGateFromEvent(assignmentId: string): Promise<void> {
        const result = await this.assignmentsRepository.delete(assignmentId);
        if (result.affected === 0) {
            throw new NotFoundException('Assignment not found');
        }
    }

    async assignScannerToGate(
        assignmentId: string,
        scannerId: string | null,
    ): Promise<GateAssignment> {
        const assignment = await this.assignmentsRepository.findOne({
            where: { id: assignmentId },
            relations: ['gate', 'event', 'scanner'],
        });
        if (!assignment) {
            throw new NotFoundException('Gate assignment not found');
        }

        if (scannerId) {
            // Validate scanner
            const scanner = await this.usersRepository.findOne({
                where: { id: scannerId, role: UserRole.SCANNER },
            });
            if (!scanner) {
                throw new BadRequestException('Invalid scanner or user is not a scanner');
            }
            assignment.scanner_id = scannerId;
            assignment.scanner = scanner;

            // Also update the user's assigned_gate field for backward compatibility
            scanner.assigned_gate = assignment.gate.name;
            await this.usersRepository.save(scanner);
        } else {
            // Remove scanner assignment
            if (assignment.scanner) {
                assignment.scanner.assigned_gate = null;
                await this.usersRepository.save(assignment.scanner);
            }
            assignment.scanner_id = null;
            assignment.scanner = null;
        }

        return this.assignmentsRepository.save(assignment);
    }

    // ==================== SCANNER-SPECIFIC ====================

    async getScanners(): Promise<User[]> {
        return this.usersRepository.find({
            where: { role: UserRole.SCANNER, is_active: true },
            order: { first_name: 'ASC', last_name: 'ASC' },
        });
    }

    async getScannerAssignments(scannerId: string): Promise<GateAssignment[]> {
        return this.assignmentsRepository.find({
            where: { scanner_id: scannerId },
            relations: ['gate', 'event'],
            order: { event: { start_date: 'DESC' } },
        });
    }

    // Get gates with their current usage counts
    async getGatesWithStats(): Promise<
        (Gate & { assignment_count: number; active_events_count: number })[]
    > {
        const gates = await this.gatesRepository.find({
            relations: ['assignments', 'assignments.event'],
            order: { name: 'ASC' },
        });

        return gates.map((gate) => ({
            ...gate,
            assignment_count: gate.assignments?.length || 0,
            active_events_count:
                gate.assignments?.filter(
                    (a) => a.event?.status === 'PUBLISHED',
                ).length || 0,
        })) as (Gate & { assignment_count: number; active_events_count: number })[];
    }
}
