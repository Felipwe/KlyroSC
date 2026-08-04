const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const root = process.argv[2]
const iconB64 = fs.readFileSync(path.join(root, 'build', 'icon.png')).toString('base64')

const bgHtml = `<!doctype html><html><body style="margin:0"><div style="
  width:1120px;height:720px;overflow:hidden;position:relative;
  background:#070608;font-family:'Segoe UI',sans-serif;">
  <div style="position:absolute;inset:0;
    background:radial-gradient(70% 90% at 14% 112%, rgba(179,20,35,.34), transparent 58%),
               radial-gradient(60% 80% at 90% -12%, rgba(122,14,24,.22), transparent 60%);"></div>
  <div style="position:absolute;left:0;top:0;bottom:0;width:5px;
    background:linear-gradient(180deg,#7a0e18,#e5484d 50%,#7a0e18);"></div>
  <div style="position:relative;text-align:center;padding-top:74px;">
    <img src="data:image/png;base64,${iconB64}" width="150" height="150"
      style="filter:drop-shadow(0 0 34px rgba(179,20,35,.6));"/>
    <div style="margin-top:22px;font-size:50px;font-weight:800;letter-spacing:1px;color:#e8e4e0;line-height:1;">
      Klyro<span style="color:#e5484d;">SC</span>
    </div>
    <div style="margin-top:10px;font-size:19px;letter-spacing:7px;color:#97918c;text-transform:uppercase;">
      music client
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:230px;
    background:linear-gradient(180deg,transparent,rgba(10,6,8,.66));"></div>
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
