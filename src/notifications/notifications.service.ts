import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationType } from '../common/enums';

interface SendNotificationInput {
  userId: string;
  reservationId?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const TEMPLATES: Record<NotificationType, { title: string; body: string }> = {
  [NotificationType.RESERVATION_CONFIRMED]: {
    title: 'Reservation confirmed',
    body: 'Your BlackLabel reservation has been confirmed.',
  },
  [NotificationType.CHAUFFEUR_ASSIGNED]: {
    title: 'Chauffeur assigned',
    body: 'A chauffeur has been assigned to your reservation.',
  },
  [NotificationType.CHAUFFEUR_ON_THE_WAY]: {
    title: 'Chauffeur is on the way',
    body: 'Your chauffeur is on the way to the pickup location.',
  },
  [NotificationType.CHAUFFEUR_ARRIVED]: {
    title: 'Chauffeur has arrived',
    body: 'Your chauffeur is waiting at the pickup location.',
  },
  [NotificationType.TRIP_COMPLETED]: {
    title: 'Trip completed',
    body: 'Your trip is complete. Thank you for choosing BlackLabel.',
  },
  [NotificationType.PAYMENT_RECEIVED]: {
    title: 'Payment received',
    body: 'Your payment was successfully processed.',
  },
  [NotificationType.GENERAL]: {
    title: 'BlackLabel Car Services',
    body: '',
  },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  /** Convenience: send one of the 5 standard trip-lifecycle notifications using its default copy. */
  async sendTemplate(
    userId: string,
    type: NotificationType,
    reservationId?: string,
    data?: Record<string, unknown>,
  ) {
    const template = TEMPLATES[type];
    return this.send({ userId, reservationId, type, title: template.title, body: template.body, data });
  }

  async send(input: SendNotificationInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('notifications')
      .insert({
        user_id: input.userId,
        reservation_id: input.reservationId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to persist notification: ${error.message}`);
      return null;
    }

    await this.pushToDevice(input.userId, input.title, input.body, input.data);
    return data;
  }

  async listForUser(userId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async markRead(notificationId: string, userId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Push delivery stub. Wire up FCM (or APNs/OneSignal) here — look up the
   * user's stored device token(s) and call the provider's send API using
   * `fcm.serverKey` from config. Kept as a stub so Phase 2 doesn't hard-code
   * a specific push provider choice.
   */
  private async pushToDevice(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const fcmKey = this.config.get<string>('fcm.serverKey');
    if (!fcmKey) return; // push not configured; DB row + in-app polling still works
    this.logger.debug(`(stub) would push "${title}" to user ${userId}`);
    // TODO: fetch device tokens for userId and call FCM's HTTP v1 API.
  }
}
