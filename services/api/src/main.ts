import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';
import { validarVariaveisDeAmbiente } from './validar-env';

async function bootstrap() {
  validarVariaveisDeAmbiente();

  const app = await NestFactory.create(AppModule);

  setupApp(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}`);
}

bootstrap();
