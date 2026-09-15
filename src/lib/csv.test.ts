import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses a comma-delimited file with a header row', () => {
    const { headers, rows } = parseCsv('nome,cargo\nAna Souza,Caixa\nJoão Lima,Fiscal')
    expect(headers).toEqual(['nome', 'cargo'])
    expect(rows).toEqual([
      ['Ana Souza', 'Caixa'],
      ['João Lima', 'Fiscal'],
    ])
  })

  it('detects a semicolon delimiter (pt-BR Excel export)', () => {
    const { headers, rows } = parseCsv('nome;cargo\nAna Souza;Caixa')
    expect(headers).toEqual(['nome', 'cargo'])
    expect(rows).toEqual([['Ana Souza', 'Caixa']])
  })

  it('strips a UTF-8 BOM prefix', () => {
    const { headers } = parseCsv('﻿nome,cargo\nAna,Caixa')
    expect(headers).toEqual(['nome', 'cargo'])
  })

  it('keeps a comma inside a quoted cell intact', () => {
    const { rows } = parseCsv('nome,cargo\n"Souza, Ana",Caixa')
    expect(rows).toEqual([['Souza, Ana', 'Caixa']])
  })

  it('unescapes doubled quotes inside a quoted cell', () => {
    const { rows } = parseCsv('nome,apelido\nAna,"""Aninha"""')
    expect(rows).toEqual([['Ana', '"Aninha"']])
  })

  it('skips blank lines', () => {
    const { rows } = parseCsv('nome,cargo\nAna,Caixa\n\n\nJoão,Fiscal\n')
    expect(rows).toEqual([
      ['Ana', 'Caixa'],
      ['João', 'Fiscal'],
    ])
  })

  it('returns empty headers and rows for an empty file', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
  })
})
