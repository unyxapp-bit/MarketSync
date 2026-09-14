import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Store } from 'lucide-react'
import { createFirstStore } from '../lib/marketSyncApi'

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('')
    const values = new FormData(event.currentTarget)
    try { await createFirstStore(String(values.get('organization')), String(values.get('store'))); onComplete() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível criar a loja.') }
    finally { setLoading(false) }
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-mark"><Store size={20} /></div><p className="eyebrow">CONFIGURAÇÃO INICIAL</p><h1>Cadastre sua primeira loja</h1><p>Ela será o espaço seguro da sua equipe, setores, escalas e histórico de validações.</p><form onSubmit={submit}><label>Empresa<input required name="organization" placeholder="Ex.: Mercado Central Ltda." /></label><label>Nome da loja<input required name="store" placeholder="Ex.: Loja Centro" /></label>{message && <div className="auth-message">{message}</div>}<button disabled={loading} className="solid" type="submit">{loading ? 'Criando...' : 'Criar loja'} <ArrowRight size={16} /></button></form></section></main>
}
