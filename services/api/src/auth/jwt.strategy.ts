import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// Extrator combinado: o painel web manda o token via cookie httpOnly
// (JS nunca toca nele, protegido contra roubo por XSS); o app mobile
// continua mandando via header "Authorization: Bearer" (React Native não
// tem um mecanismo de cookie confiável entre plataformas). Tenta o cookie
// primeiro, cai para o header se não encontrar.
function extrairToken(req: Request): string | null {
  const doCookie = req.cookies?.accessToken;
  if (doCookie) return doCookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: extrairToken,
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; perfil: string; nome?: string }) {
    // O que essa função retorna vira req.user em todas as rotas protegidas
    return {
      userId: payload.sub,
      email: payload.email,
      perfil: payload.perfil,
      nome: payload.nome,
    };
  }
}
