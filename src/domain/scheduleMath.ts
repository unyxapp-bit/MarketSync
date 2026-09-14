export type Segment = { startsAt: string; endsAt: string }

const milliseconds = (value: string) => new Date(value).getTime()

export const minutesBetween = (start: string, end: string) => Math.round((milliseconds(end) - milliseconds(start)) / 60000)

export const sortSegments = (segments: Segment[]) => [...segments].sort((left, right) => milliseconds(left.startsAt) - milliseconds(right.startsAt))

export const workedMinutes = (segments: Segment[]) => sortSegments(segments).reduce((total, segment) => total + minutesBetween(segment.startsAt, segment.endsAt), 0)

export const breakMinutes = (segments: Segment[]) => {
  const sorted = sortSegments(segments)
  return sorted.slice(1).reduce((total, segment, index) => total + minutesBetween(sorted[index].endsAt, segment.startsAt), 0)
}

export const hasOverlap = (segments: Segment[]) => {
  const sorted = sortSegments(segments)
  return sorted.some((segment, index) => index > 0 && milliseconds(segment.startsAt) < milliseconds(sorted[index - 1].endsAt))
}

export const interjourneyMinutes = (previous: Segment[], current: Segment[]) => {
  if (!previous.length || !current.length) return null
  const previousEnd = sortSegments(previous).at(-1)!.endsAt
  const currentStart = sortSegments(current)[0].startsAt
  return minutesBetween(previousEnd, currentStart)
}
