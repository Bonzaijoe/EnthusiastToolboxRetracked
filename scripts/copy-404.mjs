// GitHub Pages serves 404.html for any URL that isn't a real file - which is
// every client-side route (e.g. /patch-notes), since the app is client-side
// routed with react-router's BrowserRouter. Copying the built index.html to
// 404.html means GitHub serves the app itself, which then boots and renders
// the correct route from the URL. Runs automatically after `npm run build`
// via npm's postbuild convention.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
