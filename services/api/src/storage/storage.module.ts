import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

@Module({
  providers: [
    {
      // Quem consome storage sempre injeta pelo token STORAGE_SERVICE,
      // nunca pela classe concreta. Isso é o que permite trocar
      // LocalStorageService por um S3StorageService no futuro sem
      // alterar nenhuma linha fora deste módulo.
      provide: STORAGE_SERVICE,
      useClass: LocalStorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
