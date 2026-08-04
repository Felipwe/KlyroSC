# KlyroSC Plugin API  v1

KlyroSC can be extended with plugins: small JavaScript modules that run in an isolated sandbox inside the main process, with access to a permission-scoped API. A crashing plugin never takes the app down  errors are caught, logged, and a plugin that fails 5 times in a row is disabled automatically.

## Anatomy of a plugin

A plugin is a folder containing at least two files:

```
my-plugin/
├── plugin.json   # manifest
└── index.js      # entry module
```

Built-in plugins ship with the app (`resources/plugins`). External plugins live in the user data folder (`Settings → Plugins → Open plugins folder`) and can be installed with **Settings → Plugins → Install from folder**, which copies the folder into place.

## Manifest (`plugin.json`)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does, shown in Settings.",
  "author": "You",
  "main": "index.js",
  "apiVersion": 1,
  "appRange": ">=2.0.0",
  "permissions": ["network", "storage"],
  "settings": [
    { "key": "greeting", "type": "string", "label": "Greeting", "default": "hi" },
    { "key": "enabled", "type": "boolean", "label": "Enabled", "default": true },
    { "key": "limit", "type": "number", "label": "Limit", "default": 10, "min": 1, "max": 60 },
    {
      "key": "mode",
      "type": "select",
      "label": "Mode",
      "default": "a",
      "options": [{ "value": "a", "label": "A" }, { "value": "b", "label": "B" }]
    }
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | `^[a-z0-9][a-z0-9-]{1,40}$`, unique |
| `name` | yes | up to 60 chars |
| `version` | yes | strict `x.y.z` |
| `main` | yes | a `.js` file inside the plugin folder |
| `apiVersion` | yes | must be `1` |
| `appRange` | no | semver range checked against the KlyroSC version |
| `permissions` | yes | any of `network`, `notifications`, `player`, `storage`, `shell` |
| `settings` | no | schema rendered automatically in Settings → Plugins |

Fields with `"secret": true` render as password inputs.

## Entry module (`index.js`)

CommonJS-style exports. `activate` receives the `klyro` context; `deactivate` is called when the plugin is disabled, reloaded or the app quits.

```js
module.exports = {
  activate(klyro) {
    klyro.log('hello from', klyro.id)
    klyro.player.onTrack((track) => {
      if (track) klyro.log('now playing:', track.title)
    })
  },
  deactivate() {}
}
```

The sandbox provides `module`, `exports`, `console` (routed to the app log), `setTimeout` / `setInterval` (tracked and cleared on deactivate), `URL`, `URLSearchParams`, `TextEncoder` and `TextDecoder`. There is **no** `require`, `process` or filesystem access.

## The `klyro` context

### Always available

| Member | Description |
| --- | --- |
| `id` | Plugin id |
| `appVersion` | KlyroSC version string |
| `log(...args)` | Writes to the app log (`Settings → Data → Open logs folder`) |
| `md5(text)` | MD5 hex digest (handy for Last.fm-style signatures) |
| `isWindowFocused()` | Whether the KlyroSC window is focused |
| `getConfig()` | Current config object (defaults merged with user values) |
| `updateConfig(patch)` | Persists config changes and notifies listeners |
| `onConfigChange(cb)` | Called with the new config after every change; returns unsubscribe |
| `player.getTrack()` | Current track (`{ id, title, artist, artwork, duration, url, … }` or `null`) |
| `player.isPlaying()` | Playback state |
| `player.onTrack(cb)` | Track change events; returns unsubscribe |
| `player.onState(cb)` | Play/pause events; returns unsubscribe |
| `player.onProgress(cb)` | `(position, duration)` roughly every 10 s while playing |

### Permission-gated

| Member | Permission | Description |
| --- | --- | --- |
| `fetch(url, init?)` | `network` | HTTPS-only fetch with a 20 s timeout |
| `storage.get()` / `storage.set(obj)` | `storage` | Per-plugin JSON persistence |
| `notify(title, body)` | `notifications` | Native desktop notification |
| `toast(message)` | `notifications` | In-app toast |
| `openExternal(url)` | `shell` | Opens an HTTPS URL in the default browser |
| `player.playPause()` / `player.play()` / `player.pause()` / `player.next()` / `player.previous()` | `player` | Playback control |

Calling a gated API without the permission throws.

## Lifecycle and fault isolation

- Plugins are validated, compatibility-checked (`apiVersion`, `appRange`) and listed in Settings even when incompatible (with the reason).
- Every callback is wrapped: exceptions are recorded as the plugin error and shown in Settings.
- After 5 errors the plugin is stopped and disabled, with a toast to the user.
- `deactivate()` plus automatic timer/listener cleanup runs on disable, reload and quit.
- Source files are capped at 512 KB and must live inside the plugin folder.

## Development loop

1. Create the folder with `plugin.json` + `index.js` inside the external plugins directory (`Settings → Plugins → Open plugins folder`).
2. Click **Reload plugins**.
3. Watch logs at `Settings → Data → Open logs folder` (`plugin:<id>` scope).

The bundled plugins in [resources/plugins](../resources/plugins) are complete working references: `sleep-timer` (timers + config + player control), `track-notifier` (events + notifications) and `lastfm-scrobbler` (network, storage, auth flow and scrobbling).
