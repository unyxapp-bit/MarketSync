export type Shift = { start: string; breakStart: string; breakEnd: string; end: string }
export type Employee = { name: string; sector: string; schedule: Array<Shift | null> }
