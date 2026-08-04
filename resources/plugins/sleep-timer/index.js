let ctx = null
let timer = null

function schedule(config) {
  if (timer) {
    ctx.clearTimeout(timer)
    timer = null
  }
  if (!config.armed) return
  const minutes = Math.min(240, Math.max(5, Number(config.minutes) || 30))
  ctx.log('armed for ' + minutes + ' minutes')
  timer = ctx.setTimeout(() => {
    timer = null
    ctx.player.pause()
    ctx.toast('Sleep timer  playback paused. Good night!')
    ctx.updateConfig({ armed: false })
  }, minutes * 60 * 1000)
}

module.exports = {
  activate(klyro) {
    ctx = klyro
    schedule(klyro.getConfig())
    klyro.onConfigChange(schedule)
  },
  deactivate() {
    if (timer && ctx) ctx.clearTimeout(timer)
    timer = null
  }
}
