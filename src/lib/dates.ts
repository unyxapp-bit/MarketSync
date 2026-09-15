const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAY_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// All date math is done at noon UTC so DST/timezone shifts never roll the calendar day over.
export const addDays = (iso: string, amount: number) => {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

export const mondayOf = (iso: string) => {
  const date = new Date(`${iso}T12:00:00Z`)
  const day = date.getUTCDay()
  return addDays(iso, day === 0 ? -6 : 1 - day)
}

export type WeekDay = { iso: string; weekday: string; date: string; label: string }

export const weekdayShort = (iso: string) => WEEKDAY_SHORT[new Date(`${iso}T12:00:00Z`).getUTCDay()]

export const weekDates = (weekStart: string): WeekDay[] =>
  Array.from({ length: 7 }, (_, index) => {
    const iso = addDays(weekStart, index)
    const date = new Date(`${iso}T12:00:00Z`)
    const dayOfWeek = date.getUTCDay()
    const dayNumber = date.getUTCDate()
    return {
      iso,
      weekday: WEEKDAY_SHORT[dayOfWeek],
      date: String(dayNumber).padStart(2, '0'),
      label: `${WEEKDAY_LONG[dayOfWeek]}, ${dayNumber} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`,
    }
  })

export const weekRangeLabel = (weekStart: string) => {
  const [first, , , , , , last] = weekDates(weekStart)
  const firstDate = new Date(`${first.iso}T12:00:00Z`)
  const lastDate = new Date(`${last.iso}T12:00:00Z`)
  const year = lastDate.getUTCFullYear()
  if (firstDate.getUTCMonth() === lastDate.getUTCMonth()) {
    return `${first.date} a ${last.date} de ${MONTHS[lastDate.getUTCMonth()]} de ${year}`
  }
  return `${first.date} de ${MONTHS[firstDate.getUTCMonth()]} a ${last.date} de ${MONTHS[lastDate.getUTCMonth()]} de ${year}`
}
