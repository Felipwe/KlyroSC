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
    version: '2.12.0',
    pt: [
      'Contador de notificações no ícone da barra de tarefas: mensagens, Jam, pedidos e atualizações (9+ quando passa de nove)',
      'Corrigido: menus de seleção não abriam as opções ao clicar',
      'Código de acesso do Socials em Configurações > Conta — borrado por padrão, passe o mouse para revelar e clique para copiar',
      'O botão de excluir conta saiu do app: contas inativas por mais de 180 dias agora são excluídas automaticamente'
    ],
    en: [
      'Notification counter on the taskbar icon: messages, Jam, requests and updates (9+ past nine)',
      'Fixed: select menus were not opening their options on click',
      'Socials access code in Settings > Account — blurred by default, hover to reveal and click to copy',
      'The delete account button is gone: accounts inactive for over 180 days are now removed automatically'
    ]
  },
  {
    version: '2.11.0',
    pt: [
      'Animações estilo iOS em tudo: cada botão, menu e clique responde com uma mola suave e sutil',
      'Menus, modais, painéis, toasts e chats agora também fecham com animação — nada mais some de repente',
      'Fila da Jam no menu do player, mostrando quem adicionou cada música (avatar e nome)',
      'A fila da Jam agora é a prioridade: todos os membros seguem exatamente a mesma fila',
      'Permissão “convidados podem controlar” de volta, direto no menu da Jam',
      'Nomes no chat da Jam em branco padrão e perfil do amigo em vidro translúcido de verdade'
    ],
    en: [
      'iOS-style animations everywhere: every button, menu and click responds with a soft, subtle spring',
      'Menus, modals, panels, toasts and chats now animate on close too — nothing vanishes abruptly',
      'Jam queue inside the player menu, showing who added each track (avatar and name)',
      'The Jam queue is now the priority: every member follows exactly the same queue',
      '“Guests can control” permission is back, right in the Jam menu',
      'Jam chat names in standard white and the friend profile in true translucent glass'
    ]
  },
  {
    version: '2.10.0',
    pt: [
      'Confirmação de leitura no chat: relógio enviando, ✓✓ cinza entregue e ✓✓ azul quando o amigo vê, igual WhatsApp',
      'Status manual estilo Discord: Online, Ausente ou Não perturbe — seus amigos veem na hora',
      'Social reorganizado em abas: Amigos e Perfil, com foto, nome e status em um só lugar',
      'Perfil dos amigos: clique em alguém para ver status, o que está ouvindo, tempo de escuta e a música mais repetida',
      'Seu perfil mostra o tempo total ouvindo música e sua faixa mais ouvida',
      'Visual liquid glass no app inteiro: menus, cards e painéis translúcidos com blur estilo iOS',
      'A barra grande de Jam saiu do Social — tudo pelo menu compacto no player'
    ],
    en: [
      'Read receipts in chat: clock while sending, gray ✓✓ delivered and blue ✓✓ when your friend sees it, WhatsApp style',
      'Discord-style manual status: Online, Away or Do not disturb — friends see it instantly',
      'Social reorganized into tabs: Friends and Profile, with photo, name and status in one place',
      'Friend profiles: click someone to see their status, what they are listening to, listening time and most repeated track',
      'Your profile shows total time listening to music and your most played track',
      'Liquid glass look across the whole app: translucent blurred menus, cards and panels, iOS style',
      'The big Jam bar left the Social page — everything lives in the compact player menu'
    ]
  },
  {
    version: '2.9.1',
    pt: [
      'Visual liquid glass: botões que seguem a cor da música agora são vidro translúcido com blur, no estilo iOS',
      'Notificações redesenhadas: pill transparente com blur, sem a bolinha colorida',
      'O botão de Jam agora abre um menu com a opção “Criar Jam” — nada é criado sem você confirmar'
    ],
    en: [
      'Liquid glass look: buttons that follow the music\u2019s color are now translucent blurred glass, iOS style',
      'Redesigned notifications: transparent blurred pill, without the colored dot',
      'The Jam button now opens a menu with a “Start a Jam” option — nothing is created until you confirm'
    ]
  },
  {
    version: '2.9.0',
    pt: [
      'Jam na barra do player: um clique no novo botão ao lado das letras inicia uma jam na hora',
      'Menu da jam sem sair da tela: veja quem está ouvindo, remova alguém, passe a posse e abra o chat — tudo pelo player',
      'O chat da jam agora abre em qualquer página do app',
      'Configurações mais enxutas: opções técnicas de vidro, animações, stream e fade foram removidas'
    ],
    en: [
      'Jam from the player bar: one click on the new button next to lyrics starts a jam instantly',
      'Jam menu without leaving your screen: see who is listening, remove someone, hand over the crown and open the chat — right from the player',
      'The jam chat now opens on any page of the app',
      'Leaner settings: technical glass, animations, stream and fade options were removed'
    ]
  },
  {
    version: '2.8.3',
    pt: [
      'Jams agora sobrevivem a reinícios do servidor: manutenções e atualizações não encerram mais a sua jam — a sincronização retoma sozinha em segundos'
    ],
    en: [
      'Jams now survive server restarts: maintenance and updates no longer end your jam — sync resumes on its own within seconds'
    ]
  },
  {
    version: '2.8.2',
    pt: [
      'Nome de exibição editável no Socials: clique no lápis ao lado do seu nome — único e opcional, seus amigos veem na hora',
      'Janelas de chat agora abrem centralizadas na sua frente, em vez de escondidas no canto'
    ],
    en: [
      'Editable display name on Socials: click the pencil next to your name — unique and optional, friends see it instantly',
      'Chat windows now open centered in front of you instead of tucked into the corner'
    ]
  },
  {
    version: '2.8.1',
    pt: [
      'Corrigido: as opções do tema personalizado apareciam duplicadas nas configurações'
    ],
    en: [
      'Fixed: custom theme options were showing up duplicated in settings'
    ]
  },
  {
    version: '2.8.0',
    pt: [
      'Chat da Jam: converse com todo mundo da jam em grupo, com aviso de não lidas',
      'A jam não morre mais: se o dono fechar o app, a posse passa para o membro mais antigo',
      'Fila da jam sincronizada com a sua fila e mostrando quem adicionou cada música',
      'Discord mostra a jam no seu perfil (Jam 2/8)',
      'Barra lateral ajustável: arraste a borda — bem estreita vira só ícones; duplo clique volta ao padrão',
      'Chats abrem no canto inferior direito, empilhando organizados',
      'Anti-spam leve nos chats para manter a conversa saudável'
    ],
    en: [
      'Jam chat: talk with everyone in the jam as a group, with unread badges',
      'Jams no longer die: if the host closes the app, ownership passes to the oldest member',
      'Jam queue synced with your local queue and showing who added each track',
      'Discord shows the jam on your profile (Jam 2/8)',
      'Resizable sidebar: drag the edge — very narrow becomes icons-only; double-click resets',
      'Chats open at the bottom-right corner, stacking neatly',
      'Light anti-spam on chats to keep conversations healthy'
    ]
  },
  {
    version: '2.7.1',
    pt: [
      'Chats em janelas flutuantes: arraste pelo cabeçalho, redimensione pelo canto e abra várias conversas ao mesmo tempo',
      'Foto de perfil no Socials: clique no seu avatar para escolher uma imagem — seus amigos veem na hora',
      'Clicar em uma janela de chat traz ela para a frente, como um app de verdade'
    ],
    en: [
      'Floating chat windows: drag by the header, resize from the corner and keep several conversations open at once',
      'Socials profile picture: click your avatar to pick an image — friends see it instantly',
      'Clicking a chat window brings it to the front, like a real app'
    ]
  },
  {
    version: '2.7.0',
    pt: [
      'KlyroSC Socials: conta anônima estilo Mullvad  sem e-mail nem senha, você ganha um nome aleatório, um ID (#42) e um código secreto de 16 dígitos que é sua única chave',
      'Jam ao vivo: ouça a mesma música com até 8 amigos em tempo real, com convites, fila sincronizada e controle do dono sobre o que os convidados podem fazer',
      'Chat criptografado de ponta a ponta com indicador de “digitando…”  o servidor nunca vê o conteúdo das mensagens',
      'Amigos por ID: adicione pelo #ID, veja quem está online e o que estão ouvindo ao vivo',
      'Tocar da pesquisa virou mix: a fila continua com faixas parecidas em vez de repetir a mesma música',
      'Visual mais limpo: ícone removido ao lado do logo na barra de título'
    ],
    en: [
      'KlyroSC Socials: Mullvad-style anonymous account  no e-mail or password, you get a random name, an ID (#42) and a secret 16-digit code as your only key',
      'Live Jam: listen to the same music with up to 8 friends in real time, with invites, synced queue and host control over what guests can do',
      'End-to-end encrypted chat with a live “typing…” indicator  the server never sees message contents',
      'Friends by ID: add people by their #ID, see who is online and what they are listening to live',
      'Playing from search is now a mix: the queue continues with similar tracks instead of repeating the same song',
      'Cleaner look: removed the icon next to the logo in the title bar'
    ]
  },
  {
    version: '2.6.1',
    pt: [
      'Novo seletor de cores do tema personalizado: painel próprio do KlyroSC com área de saturação, barra de matiz, campo hex, conta-gotas para capturar cor da tela e cores prontas  adeus janelinha padrão do navegador',
      'Cards "Voltar a ouvir" e "Continue de onde parou" agora são transparentes, integrados ao fundo como os demais cards'
    ],
    en: [
      'New custom-theme color picker: KlyroSC\'s own panel with saturation area, hue bar, hex field, screen eyedropper and preset swatches  goodbye default browser popup',
      '"Back to listening" and "Continue where you left off" cards are now transparent, blending with the background like the other cards'
    ]
  },
  {
    version: '2.6.0',
    pt: [
      'Reprodução reconstruída: falhas de carregamento agora são detectadas em segundos e o app se recupera sozinho  chega de música carregando para sempre',
      'Bypass de região definitivo: faixas bloqueadas no seu país passam automaticamente pela rota do player embarcado do SoundCloud, que destrava a versão completa',
      'Músicas Go+ e indisponíveis: o app busca um reupload completo e limpo da mesma faixa antes de aceitar a prévia de 30s',
      'Se o áudio travar no meio da música, o KlyroSC pega um novo link e continua de onde parou automaticamente'
    ],
    en: [
      'Playback rebuilt: loading failures are now detected within seconds and the app recovers on its own  no more tracks loading forever',
      'Definitive region bypass: tracks blocked in your country automatically go through the SoundCloud embedded-player route, which unlocks the full version',
      'Go+ and unavailable songs: the app searches for a clean full-length reupload of the same track before settling for the 30s preview',
      'If audio stalls mid-song, KlyroSC grabs a fresh link and resumes right where it stopped automatically'
    ]
  },
  {
    version: '2.5.5',
    pt: [
      'A tela de login do SoundCloud agora abre maximizada, sem o formulário apertado e cortado',
      'Cabeçalho das letras corrigido: capa, título e botão fechar ficam fixos enquanto somente as linhas rolam',
      'Letras muito mais confiáveis: artista, título, duração e intervalo de sincronia agora precisam combinar  resultados de outra música são rejeitados'
    ],
    en: [
      'The SoundCloud login screen now opens maximized, without a cramped or clipped form',
      'Fixed the lyrics header: cover, title and close button stay fixed while only the lines scroll',
      'Much more reliable lyrics: artist, title, duration and timing range must now match  results from another song are rejected'
    ]
  },
  {
    version: '2.5.4',
    pt: [
      'Login com Google, Facebook e Apple corrigido: o SoundCloud agora consegue abrir a janela segura do provedor sem pedir para ativar popups',
      'A janela do provedor usa a mesma sessão do SoundCloud e fecha automaticamente quando o login termina'
    ],
    en: [
      'Google, Facebook and Apple login fixed: SoundCloud can now open the secure provider window without asking you to enable popups',
      'The provider window shares the SoundCloud session and closes automatically when login completes'
    ]
  },
  {
    version: '2.5.3',
    pt: [
      'Login com SoundCloud corrigido: quem via a tela “You have been blocked” agora consegue entrar normalmente',
      'A proteção anti-bô do SoundCloud reprovava a identidade desatualizada do app e o bloqueador de anúncios dentro da janela de login  os dois foram corrigidos'
    ],
    en: [
      'SoundCloud sign-in fixed: if you saw the “You have been blocked” screen, you can now log in normally',
      'SoundCloud’s bot protection rejected the app’s outdated identity and the ad blocker inside the login window  both fixed'
    ]
  },
  {
    version: '2.5.2',
    pt: [
      'Player 100% transparente no tema Capa da música: sem linha e sem vidro  os controles flutuam direto sobre a capa'
    ],
    en: [
      'Fully transparent player bar in the Album art theme: no line, no glass  the controls float right over the cover'
    ]
  },
  {
    version: '2.5.1',
    pt: [
      'Início mais limpa: a saudação agora fica direto sobre o fundo, sem caixa',
      '“Boa madrugada” entre meia-noite e 5h  chega de “bom dia” às 3 da manhã',
      'Bordas da miniatura do tema “Capa da música” corrigidas no seletor de temas'
    ],
    en: [
      'Cleaner Home: the greeting now sits directly on the background, no box',
      '“Up late” greeting between midnight and 5am  no more “good morning” at 3am',
      'Fixed the blurred edges of the “Album art” theme preview in the theme picker'
    ]
  },
  {
    version: '2.5.0',
    pt: [
      'Novo tema padrão “Capa da música”: o fundo e as cores do app seguem ao vivo a capa do que está tocando (troque nas Configurações se preferir)',
      'Tema personalizado completo: suas cores, sua imagem de fundo, desfoque, ícone sincronizado, vários perfis salvos e exportar/importar para compartilhar',
      'Seu avatar redondo no topo da Início quando logado',
      'Faixas que ficavam carregando para sempre agora se recuperam sozinhas com um link novo',
      'Sleep Timer e Track Notifier agora vêm desligados por padrão'
    ],
    en: [
      'New default “Album art” theme: the background and colors follow the playing cover live (switch in Settings if you prefer)',
      'Full custom theming: your colors, your background image, blur, synced icon, multiple saved profiles and export/import to share',
      'Your round avatar at the top of Home when signed in',
      'Tracks that loaded forever now recover on their own with a fresh link',
      'Sleep Timer and Track Notifier now ship disabled by default'
    ]
  },
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
      'Compartilhe seu equalizador: botões de exportar e importar preset  mande o arquivo para um amigo e ele aplica na hora',
      'Selo “30s” removido das listas: agora só aparece “Prévia” no player quando a faixa realmente não tem versão completa nem por bypass'
    ],
    en: [
      'Real country trending: the chart now comes from your country’s actual most-played songs of the day (real source, updated daily), matched to SoundCloud',
      'Share your equalizer: export and import preset buttons  send the file to a friend and it applies instantly',
      '“30s” badge removed from lists: only the player’s “Preview” badge shows, when a track truly has no full version even via bypass'
    ]
  },
  {
    version: '2.3.1',
    pt: [
      'Menus de seleção corrigidos: abriam no canto esquerdo por cima da barra lateral  agora abrem colados no botão, em todos os lugares',
      'Histórico de buscas no Pesquisar: suas buscas recentes aparecem quando o campo está vazio  clique para repetir ou remova uma no X'
    ],
    en: [
      'Select menus fixed: they opened at the left corner over the sidebar  now they open attached to the button, everywhere',
      'Search history in Search: your recent searches show when the field is empty  click to repeat or remove one with the X'
    ]
  },
  {
    version: '2.3.0',
    pt: [
      'Equalizador profissional de 10 bandas nas Configurações: presets prontos (Rock, Grave, Agudos…), presets seus ilimitados com nome, tudo com efeito ao vivo na música',
      'Curtir, republicar e comentar agora valem de verdade no SoundCloud quando você está logado',
      'Corrigido o volume que resetava ao trocar de música',
      'Menus (botão direito e seleção) não cortam mais nas bordas e cantos da janela',
      'Arraste playlists para reordená-las na biblioteca e na barra lateral  a ordem vai junto no exportar/importar, incluindo seus presets do equalizador'
    ],
    en: [
      'Professional 10-band equalizer in Settings: ready-made presets (Rock, Bass, Treble…), unlimited named presets of your own, all applied live to the music',
      'Like, repost and comment now truly land on SoundCloud when you are signed in',
      'Fixed the volume resetting when switching tracks',
      'Menus (right-click and selects) no longer get cut off at window edges and corners',
      'Drag playlists to reorder them in the library and sidebar  the order ships with export/import, including your equalizer presets'
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
      'Quando não dá para liberar, o app avisa claramente que é uma faixa Go+ com só prévia  sem mais loading infinito',
      'Para o original completo dessas faixas, entre com uma conta SoundCloud Go+'
    ],
    en: [
      'Go+ tracks (the 30s-only ones): Region Unblock now finds and plays a clean full-length reupload of the same song when one exists',
      'When it truly can’t, the app clearly says it’s a Go+ preview  no more infinite loading',
      'For the full original of those tracks, sign in with a SoundCloud Go+ account'
    ]
  },
  {
    version: '2.2.0',
    pt: [
      'Region Unblock agora toca a faixa INTEIRA: músicas que viravam prévia de 30s no seu país tocam completas com o plugin ativo',
      'Comente e republique direto do app quando estiver logado  republicações aparecem no seu perfil',
      'Perfis clicáveis nos comentários e seção Republicadas nos perfis',
      'Comentários com visual corrigido (fotos de perfil redondinhas de novo)',
      'Sem login, as ações sociais convidam você a entrar para a experiência completa'
    ],
    en: [
      'Region Unblock now plays the FULL track: songs degraded to 30s previews in your country play complete with the plugin on',
      'Comment and repost right from the app when signed in  reposts show on your profile',
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
      'KlyroSC reconstruído do zero como cliente nativo  sem site embutido, sem anúncios',
      'Tema Light Yagami, AdBlock, Region Unblock, letras sincronizadas e Discord RPC'
    ],
    en: [
      'KlyroSC rebuilt from scratch as a native client  no embedded site, no ads',
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
