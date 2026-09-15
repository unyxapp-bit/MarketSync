import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { signIn, signUp } from '../lib/marketSyncApi'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true); setMessage('')
    const result = mode === 'signin'
      ? await signIn(String(form.get('email')), String(form.get('password')))
      : await signUp(String(form.get('fullName')), String(form.get('email')), String(form.get('password')))
    setLoading(false)
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup') setMessage('Cadastro criado. Confira seu e-mail para confirmar o acesso.')
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-mark">M</div><p className="eyebrow">MARKETSYNC</p><h1>{mode === 'signin' ? 'Acesse sua operação' : 'Crie sua operação'}</h1><p>{mode === 'signin' ? 'Entre para administrar as escalas da sua loja.' : 'O primeiro acesso cria sua conta de gestor.'}</p><form onSubmit={submit}>{mode === 'signup' && <label>Nome completo<input required name="fullName" placeholder="Seu nome" /></label>}<label>E-mail<input required name="email" type="email" placeholder="voce@empresa.com" /></label><label>Senha<input required name="password" type="password" minLength={8} placeholder="Mínimo de 8 caracteres" /></label>{message && <div className="auth-message">{message}</div>}<button disabled={loading} className="solid" type="submit">{loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar acesso'} <ArrowRight size={16} /></button></form><button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'Ainda não tenho acesso' : 'Já tenho acesso'}</button><small><ShieldCheck size={13} />Dados protegidos por autenticação e permissões por loja.</small></section></main>
}
