import { useState, type JSX } from 'react'
import { useAuth } from '@renderer/stores/auth'
import { toast } from '@renderer/stores/toasts'

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1537307280775839794/QAS4HuG29oYh1tCvJVBgiNcT88KQdLxM3zJXInhg001EGObE9pBk-hlR2OnaVc9X2DV8'

export function FeedbackModal({ onClose }: { onClose?: () => void }): JSX.Element {
  const auth = useAuth((s) => s.state)
  const name = auth.user?.name ?? 'Anonimo'
  const [suggestion, setSuggestion] = useState('')
  const [improvements, setImprovements] = useState('')
  const [liked, setLiked] = useState<'yes' | 'no' | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async (): Promise<void> => {
    if (sending) return
    setSending(true)
    try {
      const body = `**Feedback from:** ${name}\n**Gostando:** ${liked ?? 'Não respondido'}\n**Sugestão:** ${suggestion}\n**Melhorias:** ${improvements}`
      const payload = { username: name, content: body }
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Webhook error ${res.status}`)
      toast('Feedback enviado — obrigado!', 'success')
      onClose?.()
    } catch (err) {
      console.error(err)
      toast('Erro ao enviar feedback', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="modal glass feedback-modal" role="dialog" aria-modal="true">
        <button className="close" onClick={() => onClose?.()} aria-label="Close">
          ✕
        </button>
        <h3>Feedback</h3>
        <p>Quer mandar um feedback rápido e uma sugestão?</p>

        <label style={{ display: 'block', marginTop: 8 }}>Sugestão</label>
        <textarea
          maxLength={500}
          value={suggestion}
          onChange={(e) => setSuggestion(e.currentTarget.value)}
          placeholder={'Escreva sua sugestão (opcional)'}
          style={{ width: '100%', minHeight: 80 }}
        />
        <div style={{ textAlign: 'right', fontSize: 12 }}>{suggestion.length}/500</div>

        <label style={{ display: 'block', marginTop: 8 }}>Melhorias</label>
        <textarea
          maxLength={700}
          value={improvements}
          onChange={(e) => setImprovements(e.currentTarget.value)}
          placeholder={'O que poderia ser melhor? (opcional)'}
          style={{ width: '100%', minHeight: 120 }}
        />
        <div style={{ textAlign: 'right', fontSize: 12 }}>{improvements.length}/700</div>

        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 6 }}>Você está gostando do aplicativo?</div>
          <label style={{ marginRight: 12 }}>
            <input type="radio" name="liked" value="yes" checked={liked === 'yes'} onChange={() => setLiked('yes')} /> Sim
          </label>
          <label>
            <input type="radio" name="liked" value="no" checked={liked === 'no'} onChange={() => setLiked('no')} /> Não
          </label>
        </div>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => onClose?.()} disabled={sending}>
            Cancelar
          </button>
          <button className="btn primary" onClick={submit} disabled={sending}>
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FeedbackModal
