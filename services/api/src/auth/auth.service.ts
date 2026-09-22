import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PerfilUsuario } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  // POST /auth/register só existe para criar o PRIMEIRO usuário do sistema
  // (o admin inicial, antes de existir qualquer conta). Depois que já existe
  // pelo menos 1 usuário, essa rota fica permanentemente fechada - novos
  // usuários passam a ser criados por um ADMIN já autenticado, via
  // POST /usuarios. Isso fecha o vetor de "qualquer pessoa na internet cria
  // conta e entra no ERP" sem exigir nenhuma configuração extra de deploy.
  async register(dto: RegisterDto) {
    const totalUsuarios = await this.usersService.count();
    if (totalUsuarios > 0) {
      throw new ForbiddenException(
        'Cadastro público desabilitado. Peça a um administrador para criar sua conta.',
      );
    }

    const senhaHash = await argon2.hash(dto.senha);
    const usuario = await this.usersService.create({
      nome: dto.nome,
      email: dto.email,
      senhaHash,
      perfil: PerfilUsuario.ADMIN, // o primeiro usuário do sistema é sempre admin
    });

    return this.gerarTokens(usuario.id, usuario.email, usuario.perfil, usuario.nome);
  }

  async login(dto: LoginDto) {
    const usuario = await this.usersService.findByEmail(dto.email);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await argon2.verify(usuario.senhaHash, dto.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.gerarTokens(usuario.id, usuario.email, usuario.perfil, usuario.nome);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const usuario = await this.usersService.findById(payload.sub);
      if (!usuario || !usuario.ativo) {
        throw new UnauthorizedException('Usuário inválido');
      }

      return this.gerarTokens(usuario.id, usuario.email, usuario.perfil, usuario.nome);
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  // Sempre retorna a mesma mensagem genérica, exista ou não o e-mail -
  // isso evita que alguém use essa rota para descobrir quais e-mails
  // estão cadastrados no sistema (enumeração de contas).
  async esqueciSenha(email: string) {
    const usuario = await this.usersService.findByEmail(email);

    if (usuario) {
      const token = randomBytes(32).toString('hex');
      const expiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await this.usersService.definirTokenReset(usuario.id, token, expiraEm);

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const link = `${frontendUrl}/redefinir-senha?token=${token}`;

      const { previewUrl } = await this.emailService.enviarEmailResetSenha(email, link);

      // Exposto no corpo da resposta apenas com opt-in EXPLÍCITO
      // (EXPOR_TOKEN_DEBUG=true) - nunca por padrão. Antes, a condição era só
      // "NODE_ENV !== production", que expõe o token por padrão se a variável
      // não estiver definida no ambiente de deploy (falha insegura). Também
      // não fica mais em log nenhum: um log de produção não deveria nunca
      // conter um token que dá acesso à conta de alguém.
      return {
        mensagem: 'Se o e-mail existir em nossa base, enviaremos as instruções.',
        ...(this.configService.get('EXPOR_TOKEN_DEBUG') === 'true' && {
          tokenDev: token,
          emailPreviewUrl: previewUrl,
        }),
      };
    }

    return { mensagem: 'Se o e-mail existir em nossa base, enviaremos as instruções.' };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    const usuario = await this.usersService.findByResetToken(token);

    if (!usuario || !usuario.resetSenhaExpiraEm) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    if (usuario.resetSenhaExpiraEm.getTime() < Date.now()) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const senhaHash = await argon2.hash(novaSenha);
    await this.usersService.redefinirSenha(usuario.id, senhaHash);

    return { mensagem: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
  }

  private async gerarTokens(sub: string, email: string, perfil: string, nome: string) {
    const payload = { sub, email, perfil, nome };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    return {
      accessToken,
      refreshToken,
      // Dados não-sensíveis do usuário, para quem for usar cookie httpOnly
      // (painel web) e não tiver como decodificar o token no navegador.
      usuario: { id: sub, email, perfil, nome },
    };
  }
}
