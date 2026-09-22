import { ReactNode, CSSProperties } from 'react';

export function Modal({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  return (
    <div style={styles.overlay} onClick={onFechar}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitulo}>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(16, 21, 27, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 10px 40px rgba(16,21,27,0.25)',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  modalTitulo: { fontSize: '1.1rem', marginBottom: '1rem' },
};
