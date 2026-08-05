import { type JSX } from 'react'
import { getLanguage, t, useLanguage } from '@renderer/i18n'
import { Icon } from './Icon'
import { LogoMark } from './Logo'

interface ChangelogEntry {
  version: string
  pt: string[]
  en: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.2',
    pt: [
      'Em alta agora personalizado: segue seu país e o seu gosto musical',
      'Plugins: busca, descrições em português e texto mais simples',
      'Mini player: botões e informações visíveis novamente',
      'Menus de seleção sem vazamento visual e instalador com dados do fornecedor'
    ],
    en: [
      'Trending now personalized: follows your country and your taste',
      'Plugins: search, Portuguese descriptions, simpler wording',
      'Mini player: buttons and info visible again',
      'Select menus no longer bleed through; installer carries publisher info'
    ]
  },
  {
    version: '2.0.1',
    pt: [
      'Smart Shuffle: ordem aleatória inteligente que evita repetir artista e segue a vibe da fila (plugin novo, já ativo)',
      'Histórico corrigido: faixas puladas não entram mais como ouvidas',
      'Este card de novidades após cada atualização',
      'Atualização automática ativada por padrão'
    ],
    en: [
      'Smart Shuffle: flow-aware random order that avoids artist repeats (new plugin, on by default)',
      'History fixed: skipped tracks no longer count as played',
      'This what’s-new card after every update',
      'Automatic updates enabled by default'
    ]
  },
  {
    version: '2.0.0',
    pt: [
      'KlyroSC reconstruído do zero como cliente nativo — sem site embutido, sem anúncios',
      'Tema Light Yagami, AdBlock, Region Unblock, letras sincronizadas e Discord RPC'
    ],
    en: [
      'KlyroSC rebuilt from scratch as a native client — no embedded site, no ads',
      'Light Yagami theme, AdBlock, Region Unblock, synced lyrics and Discord RPC'
    ]
  }
]

interface ChangelogCardProps {
  version: string
  onClose(): void
}

export function ChangelogCard({ version, onClose }: ChangelogCardProps): JSX.Element | null {
  useLanguage()
  const entry = CHANGELOG.find((item) => item.version === version) ?? CHANGELOG[0]
  if (!entry) return null
  const items = getLanguage() === 'pt' ? entry.pt : entry.en

  return (
    <div
      className="scrim changelog-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal glass changelog-card" role="dialog" aria-modal="true">
        <div className="cl-head">
          <LogoMark size={40} />
          <div>
            <h3>{t('changelog.title')}</h3>
            <span className="badge accent">v{entry.version}</span>
          </div>
        </div>
        <div className="cl-list">
          {items.map((item, index) => (
            <div key={index} className="cl-item" style={{ animationDelay: `${0.06 * index}s` }}>
              <span className="cl-dot">
                <Icon name="sparkle" size={12} />
              </span>
              {item}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn primary" style={{ width: '100%' }} onClick={onClose}>
            {t('changelog.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
