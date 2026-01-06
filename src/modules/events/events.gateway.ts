import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('EventsGateway');

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('joinEvent')
    handleJoinEvent(client: Socket, eventId: string) {
        client.join(`event_${eventId}`);
        this.logger.log(`Client ${client.id} joined event_${eventId}`);
        return { event: 'joined', room: `event_${eventId}` };
    }

    @SubscribeMessage('leaveEvent')
    handleLeaveEvent(client: Socket, eventId: string) {
        client.leave(`event_${eventId}`);
        this.logger.log(`Client ${client.id} left event_${eventId}`);
        return { event: 'left', room: `event_${eventId}` };
    }

    emitCheckIn(eventId: string, data: any) {
        this.server.to(`event_${eventId}`).emit('checkInUpdate', data);
    }

    emitStatsUpdate(eventId: string, data: any) {
        this.server.to(`event_${eventId}`).emit('statsUpdate', data);
    }
}
