import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'sesi',
})
export class SesiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SesiGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client terhubung: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client terputus: ${client.id}`);
  }

  @SubscribeMessage('join_sesi')
  handleJoinSesi(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sesi_id: string },
  ) {
    if (data?.sesi_id) {
      client.join(data.sesi_id);
      this.logger.log(`Client ${client.id} bergabung ke room sesi: ${data.sesi_id}`);
      return { status: 'joined', room: data.sesi_id };
    }
  }

  @SubscribeMessage('leave_sesi')
  handleLeaveSesi(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sesi_id: string },
  ) {
    if (data?.sesi_id) {
      client.leave(data.sesi_id);
      this.logger.log(`Client ${client.id} keluar dari room sesi: ${data.sesi_id}`);
      return { status: 'left', room: data.sesi_id };
    }
  }

  /**
   * Broadcast event ketika siswa berhasil scan QR ke room guru
   */
  emitScanMasuk(sesiId: string, payload: any) {
    this.server.to(sesiId).emit('scan_masuk', payload);
  }

  /**
   * Broadcast event ketika sesi ditutup/kedaluwarsa
   */
  emitSesiSelesai(sesiId: string, payload: any) {
    this.server.to(sesiId).emit('sesi_selesai', payload);
  }
}
