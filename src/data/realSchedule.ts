export type Shift = { start: string; breakStart: string; breakEnd: string; end: string }
export type Employee = { name: string; sector: string; schedule: Array<Shift | null> }

const shift = (start: string, breakStart: string, breakEnd: string, end: string): Shift => ({ start, breakStart, breakEnd, end })
const M = shift('07:40', '12:20', '14:20', '17:40')
const MT = shift('07:40', '12:30', '14:30', '17:40')
const E = shift('09:00', '12:20', '14:20', '19:00')
const C = shift('11:20', '14:30', '16:30', '20:20')
const CT = shift('11:20', '14:20', '16:20', '21:20')
const L = shift('12:20', '16:30', '17:30', '21:20')
const P = shift('12:40', '16:40', '17:40', '21:40')
const S = shift('07:50', '09:15', '09:30', '13:20')

// Transcrição da escala física enviada para a semana de 14-20/09/2026. Usada uma única vez pelo
// botão "Importar escala inicial" para semear o Supabase; a partir daí toda leitura e edição do
// app vem do banco. null representa FOLGA.
export const employees: Employee[] = [
  { name: 'Francielly', sector: 'Caixa', schedule: [M, M, M, MT, MT, M, null] },
  { name: 'Wesley', sector: 'Caixa', schedule: [M, null, M, MT, MT, M, null] },
  { name: 'Joice', sector: 'Caixa', schedule: [M, M, M, MT, null, M, null] },
  { name: 'Luanne', sector: 'Caixa', schedule: [M, M, null, MT, MT, CT, null] },
  { name: 'Vitoria', sector: 'Caixa', schedule: [M, null, M, MT, MT, CT, null] },
  { name: 'Ester', sector: 'Caixa', schedule: [E, M, M, null, MT, M, S] },
  { name: 'Vanessa', sector: 'Caixa', schedule: [C, E, shift('09:00', '12:30', '14:30', '19:00'), shift('10:00', '14:00', '16:00', '20:00'), E, null, S] },
  { name: 'Renata', sector: 'Caixa', schedule: [null, C, null, CT, CT, L, null] },
  { name: 'Talita', sector: 'Caixa', schedule: [C, null, C, CT, shift('10:20', '14:20', '16:20', '21:20'), L, null] },
  { name: 'Giulia', sector: 'Caixa', schedule: [C, C, C, CT, L, L, null] },
  { name: 'Thays', sector: 'Caixa', schedule: [L, C, L, null, shift('10:00', '12:20', '14:20', '20:00'), M, S] },
  { name: 'Debora', sector: 'Caixa', schedule: [L, L, null, null, L, shift('09:00', '13:00', '15:00', '19:00'), S] },
  { name: 'Yasmin', sector: 'Caixa', schedule: [L, L, L, L, null, shift('09:00', '13:00', '15:00', '19:00'), S] },
  { name: 'Natália', sector: 'Caixa', schedule: [L, L, L, L, L, C, S] },
  { name: 'Gustavo', sector: 'Caixa', schedule: [null, L, L, L, L, L, null] },
  { name: 'Maria Eduarda', sector: 'Caixa', schedule: [null, L, L, L, L, L, null] },
  { name: 'Marco Aurelio', sector: 'Fiscal', schedule: [M, null, shift('10:00', '14:20', '16:20', '20:00'), CT, CT, CT, null] },
  { name: 'Yara', sector: 'Fiscal', schedule: [shift('09:30', '12:20', '14:20', '19:30'), M, M, null, MT, M, shift('07:40', '09:15', '09:30', '13:20')] },
  { name: 'Pedro', sector: 'Fiscal', schedule: [P, P, shift('12:40', '16:00', '17:00', '21:40'), shift('12:40', '16:00', '17:00', '21:40'), shift('12:40', '16:00', '17:00', '21:40'), shift('12:40', '16:00', '17:00', '21:40'), null] },
]
