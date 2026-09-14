import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Mail, Plus, ShieldCheck } from 'lucide-react'
import { getStoreSectors, getStoreTeam, inviteStoreMember } from '../lib/marketSyncApi'

type TeamMember = { user_id: string; full_name: string; role: string; sector_ids: string[]; can_edit_sector: boolean }
type Sector = { id: string; name: string }

export function TeamAdmin({ storeId }: { storeId: string }) {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const refresh = () => { getStoreTeam(storeId).then(setTeam).catch(() => setMessage('Você não possui permissão de gerente para administrar a equipe.')); getStoreSectors(storeId).then(setSectors) }
  useEffect(refresh, [storeId])
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage('')
    const data = new FormData(event.currentTarget)
    try {
      await inviteStoreMember({ storeId, email: String(data.get('email')), role: String(data.get('role')) as 'manager' | 'supervisor' | 'employee', sectorIds: data.getAll('sectors').map(String), canEditSector: data.get('canEdit') === 'on' })
      setMessage('Convite enviado e acesso configurado.'); event.currentTarget.reset(); refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o convite.') }
    finally { setLoading(false) }
  }
  return <section className="team-admin" id="team"><div className="audit-title"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h2>Equipe e permissões</h2><p>Convide gestores, fiscais e colaboradores e limite o acesso por setor.</p></div><span className="audit-rule"><ShieldCheck size={13} />Acesso por loja</span></div><div className="team-grid"><div className="team-list"><h3>Membros da loja</h3>{team.map((member) => <div className="team-member" key={member.user_id}><span>{member.full_name.slice(0, 2).toUpperCase()}</span><div><strong>{member.full_name}</strong><small>{member.role}{member.can_edit_sector ? ' · edita setores' : ''}</small></div></div>)}{!team.length && <p className="empty">Nenhum membro encontrado.</p>}</div><form className="invite-form" onSubmit={invite}><h3><Plus size={16} />Convidar pessoa</h3><label>E-mail<input required name="email" type="email" placeholder="nome@empresa.com" /></label><label>Papel<select name="role" defaultValue="employee"><option value="employee">Colaborador · consulta própria</option><option value="supervisor">Fiscal/encarregado · escopo setorial</option><option value="manager">Gerente · loja inteira</option></select></label><fieldset><legend>Setores autorizados</legend>{sectors.map((sector) => <label key={sector.id} className="check"><input name="sectors" value={sector.id} type="checkbox" />{sector.name}</label>)}</fieldset><label className="check"><input name="canEdit" type="checkbox" />Pode editar os setores selecionados</label>{message && <p className="invite-message">{message}</p>}<button className="solid" disabled={loading} type="submit"><Mail size={16} />{loading ? 'Enviando...' : 'Enviar convite'}</button></form></div></section>
}
