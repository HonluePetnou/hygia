import { Controller, Get, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { map, type Observable } from 'rxjs';
import { CurrentUser, type AuthenticatedUser } from '../auth/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationInbox, type BellNotification } from './notification-inbox.js';

/** Cloche de la barre supérieure (RF13) : liste et flux SSE (via le broker). */
@ApiTags('notifications')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly inbox: NotificationInbox) {}

  @Get()
  @ApiOperation({ summary: 'Notifications de la cloche visibles pour le rôle du jeton' })
  list(@CurrentUser() user: AuthenticatedUser): BellNotification[] {
    return this.inbox.list(user.role);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Flux SSE des nouvelles notifications (cloche)' })
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return this.inbox.stream(user.role).pipe(map((data) => ({ data })));
  }
}
