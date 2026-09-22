import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { IdempotenciaInterceptor } from './common/idempotencia.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CondominiosModule } from './condominios/condominios.module';
import { EquipamentosModule } from './equipamentos/equipamentos.module';
import { ManutencoesModule } from './manutencoes/manutencoes.module';
import { ManutencaoRecorrenteModule } from './manutencao-recorrente/manutencao-recorrente.module';
import { EstoqueModule } from './estoque/estoque.module';
import { StorageModule } from './storage/storage.module';
import { PdfModule } from './pdf/pdf.module';
import { ChecklistModule } from './checklist/checklist.module';
import { ChecklistModeloModule } from './checklist-modelo/checklist-modelo.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { FotosModule } from './fotos/fotos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PecasModule } from './pecas/pecas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { AcessoManutencaoModule } from './common/acesso-manutencao.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Habilita o uso de @Cron() em qualquer service do projeto - sem isso
    // (mesmo padrão de outros casos já corrigidos aqui), os decorators
    // @Cron ficam só "no papel", sem nada de fato agendando a execução.
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100, // limite básico anti-brute-force; ajustar por rota depois
        },
      ],
      // Desliga o rate limit durante os testes automatizados (Jest define
      // NODE_ENV=test sozinho). Sem isso, uma suíte de teste que chama
      // /auth/login ou /auth/esqueci-senha várias vezes em sequência rápida
      // de propósito (comportamento normal de teste, não força bruta de
      // verdade) esbarra no próprio limite pensado pra proteger produção.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CondominiosModule,
    EquipamentosModule,
    ManutencoesModule,
    ManutencaoRecorrenteModule,
    EstoqueModule,
    StorageModule,
    PdfModule,
    ChecklistModule,
    ChecklistModeloModule,
    WhatsappModule,
    FotosModule,
    DashboardModule,
    PecasModule,
    RelatoriosModule,
    AcessoManutencaoModule,
  ],
  controllers: [AppController],
  providers: [
    // Sem isso, o ThrottlerModule.forRoot acima só existia "no papel" - a
    // configuração nunca era aplicada a nenhuma rota, porque faltava
    // registrar o guard que de fato conta e bloqueia requisições.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Mesmo problema, desta vez com o interceptor de idempotência: a
    // classe e a tabela de apoio já existiam prontas, mas nada no projeto
    // registrava esse interceptor - ele nunca chegava a rodar em nenhuma
    // requisição, então o cabeçalho Idempotency-Key enviado pelo app
    // mobile era simplesmente ignorado.
    { provide: APP_INTERCEPTOR, useClass: IdempotenciaInterceptor },
  ],
})
export class AppModule {}
