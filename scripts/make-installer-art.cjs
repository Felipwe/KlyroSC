const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const root = process.argv[2]
const iconB64 = fs.readFileSync(path.join(root, 'build', 'icon.png')).toString('base64')

const bgHtml = `<!doctype html><html><body style="margin:0"><div style="
  width:1120px;height:720px;overflow:hidden;position:relative;
  background:#0a0b12;font-family:'Segoe UI',sans-serif;">
  <div style="position:absolute;width:640px;height:640px;left:-180px;bottom:-260px;border-radius:50%;
    background:#8b5cf6;opacity:.34;filter:blur(150px);"></div>
  <div style="position:absolute;width:560px;height:560px;right:-160px;top:-220px;border-radius:50%;
    background:#22d3ee;opacity:.26;filter:blur(150px);"></div>
  <div style="position:absolute;width:420px;height:420px;right:180px;bottom:-240px;border-radius:50%;
    background:#6d28d9;opacity:.22;filter:blur(130px);"></div>
  <div style="position:absolute;left:70px;right:70px;top:64px;height:400px;border-radius:44px;
    background:linear-gradient(165deg, rgba(255,255,255,.13), rgba(255,255,255,.03) 46%), rgba(16,18,28,.38);
    box-shadow: inset 0 0 0 2px rgba(255,255,255,.14), inset 0 2px 0 rgba(255,255,255,.22), 0 30px 80px rgba(0,0,0,.45);"></div>
  <div style="position:relative;text-align:center;padding-top:106px;">
    <img src="data:image/png;base64,${iconB64}" width="150" height="150"
      style="filter:drop-shadow(0 0 40px rgba(139,92,246,.55));"/>
    <div style="margin-top:20px;font-size:50px;font-weight:800;letter-spacing:1px;color:#eceef6;line-height:1;">
      Klyro<span style="background:linear-gradient(135deg,#8b5cf6,#22d3ee);-webkit-background-clip:text;color:transparent;">SC</span>
    </div>
    <div style="margin-top:10px;font-size:19px;letter-spacing:7px;color:#9aa0b5;text-transform:uppercase;">
      music client
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:250px;
    background:linear-gradient(180deg,transparent,rgba(6,7,12,.72));"></div>
</div></body></html>`

async function render(html, width, height) {
  const tmp = path.join(require('os').tmpdir(), `klyro-art-${width}x${height}.html`)
  fs.writeFileSync(tmp, html, 'utf8')
  const win = new BrowserWindow({
    show: false,
    width,
    height,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await win.loadFile(tmp)
  await new Promise((resolve) => setTimeout(resolve, 700))
  const image = await win.webContents.capturePage()
  win.destroy()
  fs.rmSync(tmp, { force: true })
  return image.resize({ width, height, quality: 'best' })
}

app.on('window-all-closed', () => {
  /* keep alive between renders */
})

app.whenReady().then(async () => {
  try {
    const bg = await render(bgHtml, 1120, 720)
    fs.writeFileSync(path.join(root, 'build', 'bootstrap-bg.png'), bg.toPNG())
    console.log('bootstrap background generated (1120x720)')
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
