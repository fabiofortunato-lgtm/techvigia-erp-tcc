import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async count() {
    return this.prisma.usuario.count();
  }

  // findUnique aceita filtros extras além do campo único, desde que o
  // campo único (email) esteja presente - por isso dá pra combinar com
  // deletedAt: null sem precisar trocar para findFirst. Antes, um usuário
  // "excluído" (soft delete) continuava conseguindo logar normalmente,
  // porque esse filtro não existia aqui.
  async findByEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email, deletedAt: null } });
  }

  async findById(id: string) {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  async create(data: {
    nome: string;
    email: string;
    senhaHash: string;
    perfil?: PerfilUsuario;
  }) {
    return this.prisma.usuario.create({ data });
  }

  // Usado pela rota POST /usuarios (só ADMIN) - cria um usuário verificando
  // duplicidade antes, com mensagem de erro clara (diferente do register()
  // de bootstrap, que só roda uma vez e não precisa dessa checagem).
  async criarPorAdmin(data: {
    nome: string;
    email: string;
    senhaHash: string;
    perfil: PerfilUsuario;
  }) {
    const existente = await this.findByEmail(data.email);
    if (existente) {
      throw new ConflictException('E-mail já cadastrado');
    }
    return this.prisma.usuario.create({
      data,
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true },
    });
  }

  // Nunca retornar senhaHash para fora da aplicação
  async findAll() {
    return this.prisma.usuario.findMany({
      where: { deletedAt: null },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true },
      orderBy: { nome: 'asc' },
    });
  }

  async updatePerfil(id: string, perfil: PerfilUsuario) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: { perfil },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true },
    });
  }

  async definirTokenReset(usuarioId: string, token: string, expiraEm: Date) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { resetSenhaToken: token, resetSenhaExpiraEm: expiraEm },
    });
  }

  async findByResetToken(token: string) {
    return this.prisma.usuario.findFirst({
      where: { resetSenhaToken: token, deletedAt: null },
    });
  }

  async redefinirSenha(usuarioId: string, senhaHash: string) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        senhaHash,
        resetSenhaToken: null,
        resetSenhaExpiraEm: null,
      },
    });
  }

  // Admin edita nome/email/ativo de QUALQUER usuário - "ativo: false" é o
  // jeito de "desligar" alguém sem apagar o histórico de OS já vinculado
  // a essa pessoa (soft delete via deletedAt teria o problema já conhecido
  // de travar o e-mail pra sempre - ver limitação documentada no README).
  async atualizarPorAdmin(
    id: string,
    data: { nome?: string; email?: string; ativo?: boolean },
  ) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id, deletedAt: null } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (data.email && data.email !== usuario.email) {
      const existente = await this.findByEmail(data.email);
      if (existente) {
        throw new ConflictException('E-mail já cadastrado');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nome: true, email: true, perfil: true, ativo: true },
    });
  }

  // Qualquer usuário autenticado edita o PRÓPRIO nome/email - não pode
  // mudar o próprio perfil (só ADMIN faz isso, via updatePerfil) nem o
  // próprio "ativo" (não faria sentido se autodesativar).
  async atualizarProprioPerfil(id: string, data: { nome?: string; email?: string }) {
    if (data.email) {
      const existente = await this.findByEmail(data.email);
      if (existente && existente.id !== id) {
        throw new ConflictException('E-mail já cadastrado');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data,
      select: { id: true, nome: true, email: true, perfil: true },
    });
  }

  // Troca de senha "sabendo a senha atual" - diferente do fluxo de
  // "esqueci minha senha" (que usa token por e-mail). Exige confirmar a
  // senha atual antes de trocar, mesmo já estando autenticado - evita que
  // alguém com a sessão aberta (ex: computador destravado, esquecido)
  // consiga trocar a senha sem saber a senha original.
  async trocarSenha(id: string, senhaAtual: string, novaSenha: string) {
    const usuario = await this.prisma.usuario.findFirst({ where: { id, deletedAt: null } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const senhaCorreta = await argon2.verify(usuario.senhaHash, senhaAtual);
    if (!senhaCorreta) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const novaSenhaHash = await argon2.hash(novaSenha);
    await this.prisma.usuario.update({
      where: { id },
      data: { senhaHash: novaSenhaHash },
    });
  }
}
