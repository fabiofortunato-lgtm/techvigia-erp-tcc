const AMBIENTES_VALIDOS = ['development', 'production', 'test'];

const SEGREDOS_DE_EXEMPLO = [
  'troque-por-um-segredo-forte-em-producao',
  'troque-por-outro-segredo-forte-em-producao',
];

/**
 * Roda uma única vez, na inicialização (main.ts), antes de qualquer coisa
 * subir. Se algo estiver errado, derruba o processo com uma mensagem clara
 * em vez de deixar a API subir com uma configuração perigosa por padrão.
 *
 * Isso existe porque vários pontos do código (cookie `secure`, exposição do
 * token de recuperação de senha) decidiam comportamento com base em
 * `NODE_ENV !== 'production'` - o que significa que ESQUECER de definir
 * NODE_ENV no deploy fazia o sistema se comportar como se estivesse em
 * desenvolvimento, silenciosamente. Validar aqui, uma vez só, no boot,
 * fecha essa classe inteira de erro de configuração, em vez de precisar
 * corrigir cada ponto individual do código que lê essa variável.
 */
export function validarVariaveisDeAmbiente() {
  const nodeEnv = process.env.NODE_ENV;

  if (!nodeEnv || !AMBIENTES_VALIDOS.includes(nodeEnv)) {
    console.error(
      `\nERRO FATAL: NODE_ENV não está definido ou tem um valor inválido ("${nodeEnv}").\n` +
        `Defina explicitamente um destes valores antes de subir a API: ${AMBIENTES_VALIDOS.join(', ')}.\n` +
        `Isso é obrigatório porque vários comportamentos de segurança (cookie "secure", ` +
        `exposição de dados de depuração) dependem dessa variável - deixá-la indefinida ` +
        `faria o sistema se comportar como se estivesse em desenvolvimento, mesmo em produção.\n`,
    );
    process.exit(1);
  }

  if (nodeEnv === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || !jwtRefreshSecret || SEGREDOS_DE_EXEMPLO.includes(jwtSecret) || SEGREDOS_DE_EXEMPLO.includes(jwtRefreshSecret)) {
      console.error(
        '\nERRO FATAL: JWT_SECRET e/ou JWT_REFRESH_SECRET não foram configurados com um ' +
          'valor real de produção (ainda estão vazios ou com o texto de exemplo do .env.example).\n' +
          'Gere dois segredos fortes e distintos antes de subir em produção, por exemplo:\n' +
          '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n',
      );
      process.exit(1);
    }

    if (!process.env.FRONTEND_URL) {
      console.error(
        '\nERRO FATAL: FRONTEND_URL não foi definido. Em produção, o CORS com credentials:true ' +
          'exige uma origem explícita - sem essa variável, o painel web não vai conseguir se ' +
          'autenticar (cookies bloqueados pelo navegador).\n',
      );
      process.exit(1);
    }

    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('scantech_dev_password')) {
      console.error(
        '\nERRO FATAL: DATABASE_URL não foi configurado com uma senha de produção real ' +
          '(ainda contém a senha de desenvolvimento do docker-compose local).\n',
      );
      process.exit(1);
    }
  }

  console.log(`Variáveis de ambiente validadas (NODE_ENV=${nodeEnv}).`);
}
