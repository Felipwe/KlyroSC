let lastId = null

module.exports = {
  activate(klyro) {
    klyro.player.onTrack((track) => {
      if (!track || track.id === lastId) return
      lastId = track.id
      const config = klyro.getConfig()
      if (config.onlyUnfocused && klyro.isWindowFocused()) return
      klyro.notify(track.title, track.artist)
    })
  },
  deactivate() {
    lastId = null
  }
}
