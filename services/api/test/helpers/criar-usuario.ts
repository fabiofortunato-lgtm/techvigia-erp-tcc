import * as argon2 from 'argon2';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';

/**
 * Cria um usuário direto no banco, via Prisma, sem passar pela API.
 *
 * Por quê: POST /auth/register só funciona para criar o PRIMEIRO usuário
 * do sistema (bootstrap) - depois disso, fica fechado de propósito (ver
 * auth.service.ts). Testes precisam criar vários usuários à vontade, então
 * criar direto via Prisma é o caminho certo aqui - mais rápido, e não
 * acopla os testes às regras de bootstrap (que podem mudar).
 */
export async function criarUsuarioTeste(
  prisma: PrismaService,
  dados: { nome: string; email: string; senha: string; perfil?: PerfilUsuario },
) {
  const senhaHash = await argon2.hash(dados.senha);
  return prisma.usuario.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      perfil: dados.perfil ?? PerfilUsuario.TECNICO,
    },
  });
}
