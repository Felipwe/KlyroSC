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
    version: '2.4.1',
    pt: [
      'Fim do inglês perdido: as seções da Início (“Mais do que você curte”, “Em alta por gênero”…) agora aparecem em português',
      'Setas de navegação nas prateleiras da Início para rolar as seções sem arrastar'
    ],
    en: [
      'No more stray language mixing: Home sections (“More of what you like”, “Trending by genre”…) now follow your app language',
      'Navigation arrows on Home shelves to scroll sections without dragging'
    ]
  },
  {
    version: '2.4.0',
    pt: [
      'Em alta do seu país de verdade: o ranking agora vem das músicas mais tocadas do dia no Brasil (fonte real, atualizada diariamente), casadas com o SoundCloud',
      'Compartilhe seu equalizador: botões de exportar e importar preset — mande o arquivo para um amigo e ele aplica na hora',
      'Selo “30s” removido das listas: agora só aparece “Prévia” no player quando a faixa realmente não tem versão completa nem por bypass'
    ],
    en: [
      'Real country trending: the chart now comes from your country’s actual most-played songs of the day (real source, updated daily), matched to SoundCloud',
      'Share your equalizer: export and import preset buttons — send the file to a friend and it applies instantly',
      '“30s” badge removed from lists: only the player’s “Preview” badge shows, when a track truly has no full version even via bypass'
    ]
  },
  {
    version: '2.3.1',
    pt: [
      'Menus de seleção corrigidos: abriam no canto esquerdo por cima da barra lateral — agora abrem colados no botão, em todos os lugares',
      'Histórico de buscas no Pesquisar: suas buscas recentes aparecem quando o campo está vazio — clique para repetir ou remova uma no X'
    ],
    en: [
      'Select menus fixed: they opened at the left corner over the sidebar — now they open attached to the button, everywhere',
      'Search history in Search: your recent searches show when the field is empty — click to repeat or remove one with the X'
    ]
  },
  {
    version: '2.3.0',
    pt: [
      'Equalizador profissional de 10 bandas nas Configurações: presets prontos (Rock, Grave, Agudos…), presets seus ilimitados com nome, tudo com efeito ao vivo na música',
      'Curtir, republicar e comentar agora valem de verdade no SoundCloud quando você está logado',
      'Corrigido o volume que resetava ao trocar de música',
      'Menus (botão direito e seleção) não cortam mais nas bordas e cantos da janela',
      'Arraste playlists para reordená-las na biblioteca e na barra lateral — a ordem vai junto no exportar/importar, incluindo seus presets do equalizador'
    ],
    en: [
      'Professional 10-band equalizer in Settings: ready-made presets (Rock, Bass, Treble…), unlimited named presets of your own, all applied live to the music',
      'Like, repost and comment now truly land on SoundCloud when you are signed in',
      'Fixed the volume resetting when switching tracks',
      'Menus (right-click and selects) no longer get cut off at window edges and corners',
      'Drag playlists to reorder them in the library and sidebar — the order ships with export/import, including your equalizer presets'
    ]
  },
  {
    version: '2.2.3',
    pt: [
      'Atualização automática de verdade: o app agora baixa E instala sozinho ao abrir, sem precisar ir na aba Atualizações',
      'Quando a nova versão termina de baixar, ele reinicia sozinho já atualizado'
    ],
    en: [
      'Real auto-update: the app now downloads AND installs on its own at launch, no need to visit the Updates tab',
      'When the new version finishes downloading, it restarts itself already updated'
    ]
  },
  {
    version: '2.2.1',
    pt: [
      'Faixas Go+ (aquelas que só tocavam 30s): o Region Unblock agora procura e toca um reupload completo e limpo da mesma música quando existe',
      'Quando não dá para liberar, o app avisa claramente que é uma faixa Go+ com só prévia — sem mais loading infinito',
      'Para o original completo dessas faixas, entre com uma conta SoundCloud Go+'
    ],
    en: [
      'Go+ tracks (the 30s-only ones): Region Unblock now finds and plays a clean full-length reupload of the same song when one exists',
      'When it truly can’t, the app clearly says it’s a Go+ preview — no more infinite loading',
      'For the full original of those tracks, sign in with a SoundCloud Go+ account'
    ]
  },
  {
    version: '2.2.0',
    pt: [
      'Region Unblock agora toca a faixa INTEIRA: músicas que viravam prévia de 30s no seu país tocam completas com o plugin ativo',
      'Comente e republique direto do app quando estiver logado — republicações aparecem no seu perfil',
      'Perfis clicáveis nos comentários e seção Republicadas nos perfis',
      'Comentários com visual corrigido (fotos de perfil redondinhas de novo)',
      'Sem login, as ações sociais convidam você a entrar para a experiência completa'
    ],
    en: [
      'Region Unblock now plays the FULL track: songs degraded to 30s previews in your country play complete with the plugin on',
      'Comment and repost right from the app when signed in — reposts show on your profile',
      'Clickable profiles in comments and a Reposts section on profiles',
      'Comments visual fixed (round avatars again)',
      'Logged-out social actions invite you to sign in for the full experience'
    ]
  },
  {
    version: '2.1.0',
    pt: [
      'Página da faixa: clique na capa ou no nome da música para ver curtidas, comentários, republicações e faixas parecidas',
      'Novo menu do tray: clique direito no ícone mostra um painel com o que está tocando, controles e atalhos',
      'Reprodução mais confiável: fim do loading infinito a faixa tenta de novo sozinha com um link novo',
      'Letras: cliques repetidos numa frase não dessincronizam mais',
      'Visual: removido o traço vermelho lateral do tema Light Yagami'
    ],
    en: [
      'Track page: click the artwork or title to see likes, comments, reposts and similar tracks',
      'New tray menu: right-click the icon for a panel with now playing, controls and shortcuts',
      'More reliable playback: no more infinite loading tracks retry themselves with a fresh link',
      'Lyrics: repeated clicks on a line no longer desync',
      'Visual: removed the red side stripe from the Light Yagami theme'
    ]
  },
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
