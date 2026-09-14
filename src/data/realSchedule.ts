export type Shift = { start: string; breakStart: string; breakEnd: string; end: string }
export type Employee = { name: string; sector: 'Caixa' | 'Fiscal'; schedule: Array<Shift | null> }

const shift = (start: string, breakStart: string, breakEnd: string, end: string): Shift => ({ start, breakStart, breakEnd, end })
const M = shift('07:40', '12:20', '14:20', '17:40')
const MT = shift('07:40', '12:30', '14:30', '17:40')
const E = shift('09:00', '12:20', '14:20', '19:00')
const C = shift('11:20', '14:30', '16:30', '20:20')
const CT = shift('11:20', '14:20', '16:20', '21:20')
const L = shift('12:20', '16:30', '17:30', '21:20')
const P = shift('12:40', '16:40', '17:40', '21:40')
const S = shift('07:50', '09:15', '09:30', '13:20')

// Transcrição das escalas enviadas (14–20/09/2026). null representa FOLGA.
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

export const dates = [
  { weekday: 'Seg', date: '14', label: 'Segunda-feira, 14 de setembro' },
  { weekday: 'Ter', date: '15', label: 'Terça-feira, 15 de setembro' },
  { weekday: 'Qua', date: '16', label: 'Quarta-feira, 16 de setembro' },
  { weekday: 'Qui', date: '17', label: 'Quinta-feira, 17 de setembro' },
  { weekday: 'Sex', date: '18', label: 'Sexta-feira, 18 de setembro' },
  { weekday: 'Sáb', date: '19', label: 'Sábado, 19 de setembro' },
  { weekday: 'Dom', date: '20', label: 'Domingo, 20 de setembro' },
]

// Domingos transcritos das escalas físicas anteriores enviadas.
// Apenas nomes presentes na equipe atual são necessários para a regra de revezamento.
export const priorSundayWork: Record<string, string[]> = {
  '2026-08-23': ['Wesley', 'Vanessa', 'Marco Aurelio', 'Talita', 'Debora', 'Gustavo'],
  '2026-08-30': ['Luanne', 'Vitoria', 'Marco Aurelio', 'Renata', 'Giulia', 'Thays', 'Yasmin', 'Maria Eduarda', 'Yara'],
  '2026-09-06': ['Wesley', 'Ester', 'Vanessa', 'Debora', 'Gustavo', 'Natália', 'Yara'],
  '2026-09-13': ['Wesley', 'Joice', 'Luanne', 'Vitoria', 'Talita', 'Giulia', 'Renata', 'Gustavo', 'Marco Aurelio'],
}

// Será preenchido quando a escala da semana seguinte for criada.
// A presença de uma data aqui significa que a folga pós-domingo foi programada.
export const nextWeekRestDay: Record<string, string | undefined> = {}

export const priorWeekDates = [
  { weekday: 'Sex', date: '11' },
  { weekday: 'Sáb', date: '12' },
  { weekday: 'Dom', date: '13' },
]

// Últimos três dias antes da semana exibida, transcritos de 11–13/09/2026.
// Eles alimentam o histórico e a interjornada da segunda-feira, 14/09.
export const priorWeekSchedule: Record<string, Array<Shift | null>> = {
  Francielly: [shift('07:40', '12:30', '14:30', '17:40'), shift('07:40', '12:30', '14:30', '17:40'), null],
  Wesley: [shift('07:40', '12:30', '14:30', '17:40'), shift('07:40', '12:30', '14:30', '17:40'), S],
  Joice: [shift('07:40', '12:30', '14:30', '17:40'), null, S],
  Luanne: [null, shift('07:40', '12:30', '14:30', '17:40'), S],
  Vitoria: [shift('07:40', '12:30', '14:30', '17:40'), shift('07:40', '12:30', '14:30', '17:40'), S],
  Ester: [shift('07:40', '12:30', '14:30', '17:40'), C, null],
  Vanessa: [C, C, null],
  Renata: [shift('09:00', '13:00', '15:00', '19:00'), null, S],
  Talita: [shift('10:30', '14:20', '16:20', '20:30'), shift('07:40', '12:30', '14:30', '17:40'), S],
  Giulia: [null, shift('09:00', '13:00', '15:00', '19:00'), S],
  Thays: [L, L, null],
  Debora: [L, L, null],
  Yasmin: [L, L, null],
  'Natália': [L, L, null],
  Gustavo: [null, shift('09:00', '13:00', '15:00', '19:00'), S],
  'Maria Eduarda': [L, L, null],
  'Marco Aurelio': [CT, shift('10:00', '14:00', '16:00', '20:00'), shift('07:40', '09:15', '09:30', '13:20')],
  Yara: [shift('07:40', '12:30', '14:30', '17:40'), shift('12:40', '16:00', '17:00', '21:40'), null],
  Pedro: [P, shift('09:00', '12:30', '13:30', '18:00'), null],
}
