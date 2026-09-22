import { FormEvent, useEffect, useState, CSSProperties } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ApiError } from '../api/client';
import { Condominio, NovoCondominioForm } from '../api/types';

const CAMPOS_OBRIGATORIOS: (keyof NovoCondominioForm)[] = [
  'nome',
  'endereco',
  'bairro',
  'cidade',
  'cep',
];

export function EditarCondominio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<NovoCondominioForm | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<Condominio>(`/condominios/${id}`)
      .then((c) =>
        setForm({
          nome: c.nome,
          cnpj: c.cnpj ?? '',
          cpf: c.cpf ?? '',
          endereco: c.endereco,
          bairro: c.bairro,
          cidade: c.cidade,
          cep: c.cep,
          telefone: c.telefone ?? '',
          whatsapp: c.whatsapp ?? '',
          email: c.email ?? '',
          sindico: c.sindico ?? '',
          zelador: c.zelador ?? '',
          periodicidade: c.periodicidade,
        }),
      )
      .catch((e: ApiError) => setErro(e.message || 'Condomínio não encontrado.'));
  }, [id]);

  function atualizarCampo<K extends keyof NovoCondominioForm>(campo: K, valor: string) {
    setForm((atual) =>
      atual
        ? { ...atual, [campo]: campo === 'periodicidade' ? Number(valor) || 0 : valor }
        : atual,
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !id) return;
    setErro(null);

    const faltando = CAMPOS_OBRIGATORIOS.filter((campo) => !form[campo]);
    if (faltando.length > 0) {
      setErro('Preencha todos os campos obrigatórios (marcados com *).');
      return;
    }

    setSalvando(true);
    try {
      // Nem CNPJ nem CPF são enviados - a rota de edição não aceita
      // alterar o documento (é o identificador do cliente; trocar
      // exigiria tratar como um cadastro diferente, não uma edição)
      const { cnpj, cpf, ...payloadSemDocumento } = form;
      void cnpj;
      void cpf;
      const payload = Object.fromEntries(
        Object.entries(payloadSemDocumento).filter(([, valor]) => valor !== ''),
      );
      await api.put(`/condominios/${id}`, payload);
      navigate(`/condominios/${id}`);
    } catch (e) {
      const mensagem = e instanceof ApiError ? e.message : 'Não foi possível salvar as alterações.';
      setErro(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  if (erro && !form) {
    return (
      <Layout titulo="Editar condomínio">
        <div style={styles.erro}>{erro}</div>
      </Layout>
    );
  }

  if (!form) {
    return (
      <Layout titulo="Editar condomínio">
        <div style={styles.estado}>Carregando…</div>
      </Layout>
    );
  }

  return (
    <Layout titulo="Editar condomínio">
      <div style={styles.topo}>
        <Link to={`/condominios/${id}`} style={styles.voltar}>
          ← Voltar
        </Link>
        <h1 style={styles.titulo}>Editar condomínio</h1>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.grid}>
          <Campo label="Nome *" valor={form.nome} onChange={(v) => atualizarCampo('nome', v)} />
          <div style={styles.campo}>
            <label style={styles.label}>{form.cnpj ? 'CNPJ' : 'CPF'}</label>
            <input
              value={form.cnpj || form.cpf || ''}
              disabled
              style={{ ...styles.input, ...styles.inputDesabilitado }}
            />
          </div>
          <Campo
            label="Endereço *"
            valor={form.endereco}
            onChange={(v) => atualizarCampo('endereco', v)}
            largo
          />
          <Campo label="Bairro *" valor={form.bairro} onChange={(v) => atualizarCampo('bairro', v)} />
          <Campo label="Cidade *" valor={form.cidade} onChange={(v) => atualizarCampo('cidade', v)} />
          <Campo
            label="CEP *"
            valor={form.cep}
            onChange={(v) => atualizarCampo('cep', v)}
            placeholder="00000-000"
          />
          <Campo
            label="Periodicidade (dias) *"
            valor={String(form.periodicidade)}
            onChange={(v) => atualizarCampo('periodicidade', v)}
            tipo="number"
          />
          <Campo label="Telefone" valor={form.telefone ?? ''} onChange={(v) => atualizarCampo('telefone', v)} />
          <Campo
            label="WhatsApp"
            valor={form.whatsapp ?? ''}
            onChange={(v) => atualizarCampo('whatsapp', v)}
            placeholder="5521999999999"
          />
          <Campo label="E-mail" valor={form.email ?? ''} onChange={(v) => atualizarCampo('email', v)} tipo="email" />
          <Campo label="Síndico" valor={form.sindico ?? ''} onChange={(v) => atualizarCampo('sindico', v)} />
          <Campo label="Zelador" valor={form.zelador ?? ''} onChange={(v) => atualizarCampo('zelador', v)} />
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        <div style={styles.acoes}>
          <button type="submit" disabled={salvando} style={styles.botaoSalvar}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
          <Link to={`/condominios/${id}`} style={styles.botaoCancelar}>
            Cancelar
          </Link>
        </div>
      </form>
    </Layout>
  );
}

function Campo({
  label,
  valor,
  onChange,
  tipo = 'text',
  placeholder,
  largo = false,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  placeholder?: string;
  largo?: boolean;
}) {
  return (
    <div style={largo ? { ...styles.campo, gridColumn: '1 / -1' } : styles.campo}>
      <label style={styles.label}>{label}</label>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  topo: {
    marginBottom: '2rem',
  },
  voltar: {
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.85rem',
  },
  titulo: {
    fontSize: '1.5rem',
    marginTop: '0.5rem',
  },
  estado: { color: 'var(--text-muted)', fontSize: '0.9rem' },
  form: {
    maxWidth: 720,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
  },
  input: {
    padding: '0.6rem 0.7rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  inputDesabilitado: {
    background: 'var(--bg)',
    color: 'var(--text-muted)',
  },
  erro: {
    marginTop: '1rem',
    padding: '0.6rem 0.75rem',
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  acoes: {
    marginTop: '1.25rem',
    display: 'flex',
    gap: '0.75rem',
  },
  botaoSalvar: {
    padding: '0.7rem 1.4rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  botaoCancelar: {
    padding: '0.7rem 1.4rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
};
