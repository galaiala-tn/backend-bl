import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { PricingModule } from './pricing/pricing.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MapsModule } from './maps/maps.module';
import { ReservationsModule } from './reservations/reservations.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TrackingModule } from './tracking/tracking.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    SupabaseModule,
    AuthModule,
    PricingModule,
    VehiclesModule,
    MapsModule,
    NotificationsModule,
    TrackingModule,
    InvoicesModule,
    PaymentsModule,
    ReservationsModule,
    AdminModule,
  ],
})
export class AppModule {}
