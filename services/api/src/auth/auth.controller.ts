import { Body, Controller, Post, Get, Patch, HttpCode, HttpStatus, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  EsqueciSenhaDto,
  RedefinirSenhaDto,
} from './dto/auth.dto';
import { AtualizarMeuPerfilDto } from './dto/atualizar-meu-perfil.dto';
import { TrocarSenhaDto } from './dto/trocar-senha.dto';

interface RequestComUsuario extends Request {
  user?: { userId: string };
}

// Configuração dos cookies httpOnly - usados pelo painel web. O app mobile
// ignora esses cookies (React Native não tem cookie jar automático) e usa
// o token retornado no corpo da resposta normalmente, via header Authorization.
function opcoesCookie(maxAgeMs: number) {
  const producao = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: producao,
    // 'none' é necessário quando o painel e a API ficam em domínios
    // diferentes (ex: painel na Vercel, API no Railway) - sem isso, o
    // navegador recusa enviar o cookie nas chamadas entre origens
    // distintas. Em desenvolvimento local, o Vite faz proxy de /api pra
    // API (mesma origem do ponto de vista do navegador), então 'lax'
    // continua funcionando normalmente aí.
    sameSite: (producao ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

const QUINZE_MINUTOS_MS = 15 * 60 * 1000;
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  private setarCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    res.cookie('accessToken', tokens.accessToken, opcoesCookie(QUINZE_MINUTOS_MS));
    res.cookie('refreshToken', tokens.refreshToken, opcoesCookie(SETE_DIAS_MS));
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.authService.register(dto);
    this.setarCookies(res, resultado);
    return resultado;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto - o argon2.verify é caro em CPU de propósito, então o rate limit também protege contra sobrecarga da API, não só contra força bruta
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const resultado = await this.authService.login(dto);
    this.setarCookies(res, resultado);
    return resultado;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prioriza o refreshToken do cookie (painel web) - só cai para o corpo
    // da requisição se não vier cookie (app mobile manda no corpo mesmo).
    const refreshToken = req.cookies?.refreshToken || dto.refreshToken;
    const resultado = await this.authService.refresh(refreshToken);
    this.setarCookies(res, resultado);
    return resultado;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: RequestComUsuario) {
    const usuario = await this.usersService.findById(req.user!.userId);
    if (!usuario) return null;
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  // Qualquer usuário autenticado edita o próprio nome/email - não dá pra
  // mudar o próprio perfil por aqui (isso continua exclusivo de ADMIN,
  // via PATCH /usuarios/:id/perfil).
  atualizarMeuPerfil(@Req() req: RequestComUsuario, @Body() dto: AtualizarMeuPerfilDto) {
    return this.usersService.atualizarProprioPerfil(req.user!.userId, dto);
  }

  @Post('trocar-senha')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  // Troca de senha "sabendo a senha atual" - diferente do fluxo de
  // esqueci-senha (token por e-mail). Fica no /auth (não em /usuarios)
  // porque só faz sentido pro próprio usuário logado, nunca por um admin
  // em nome de outra pessoa.
  async trocarSenha(@Req() req: RequestComUsuario, @Body() dto: TrocarSenhaDto) {
    await this.usersService.trocarSenha(req.user!.userId, dto.senhaAtual, dto.novaSenha);
    return { mensagem: 'Senha alterada com sucesso.' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return { mensagem: 'Sessão encerrada.' };
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.esqueciSenha(dto.email);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto.token, dto.novaSenha);
  }
}
