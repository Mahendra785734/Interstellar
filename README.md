<div align="center">
    <h1>Kyzxx Proxy</h1>
    <p>A clean, minimal web proxy built on Interstellar.</p>
</div>

## About

Kyzxx Proxy is a rebranded fork of [Interstellar](https://github.com/UseInterstellar/Interstellar),
an open-source web proxy with a clean UI and easy-to-use menus. It uses Scramjet and Ultraviolet
proxy engines with Bare-Mux, Epoxy, and Wisp transports.

## Features

- About:Blank Cloaking
- Tab Cloaking
- Wide collection of apps & games
- Clean, easy-to-use UI
- Inspect Element
- Various Themes
- Password Protection (optional)
- Built-in Tab System
- Fast Speeds

## Deployment

> [!IMPORTANT]
> You **cannot** deploy to static web hosts, including Netlify, Cloudflare Pages, and GitHub Pages.

### Local Development

```bash
git clone <your-repo-url>
cd kyzxx-proxy
pnpm install
pnpm start
```

Or with npm:

```bash
npm install
npm run start
```

The server runs on port 8080 by default (`PORT` env var).

### Password Protection

Set `challenge` to `true` in `config.js`, then run with `config=true pnpm start`.

## Credits & Licenses

Kyzxx Proxy is built on the following open-source projects:

### Original Project
- **Interstellar** — [UseInterstellar/Interstellar](https://github.com/UseInterstellar/Interstellar) — GNU AGPL-3.0

### Proxy Engines
- **Scramjet** — [MercuryWorkshop/scramjet](https://github.com/MercuryWorkshop/scramjet) — MIT
- **Ultraviolet** — MIT

### Transport & Server Libraries
- **bare-mux** — [@mercuryworkshop/bare-mux](https://github.com/MercuryWorkshop/bare-mux) — GPL-3.0
- **epoxy-transport** — [@mercuryworkshop/epoxy-transport](https://github.com/MercuryWorkshop/epoxy-transport) — GPL-3.0
- **wisp-js** — [@mercuryworkshop/wisp-js](https://github.com/MercuryWorkshop/wisp-js) — GPL-3.0
- **bare-server-node** — [@nebula-services/bare-server-node](https://github.com/nickel-sword/bare-server-node) — MIT
- **Express** — [expressjs/express](https://github.com/expressjs/express) — MIT
- **node-fetch** — [node-fetch/node-fetch](https://github.com/node-fetch/node-fetch) — MIT
- **cookie-parser** — [expressjs/cookie-parser](https://github.com/expressjs/cookie-parser) — MIT
- **cors** — [expressjs/cors](https://github.com/expressjs/cors) — MIT
- **mime** — [broofa/mime](https://github.com/broofa/mime) — MIT
- **chalk** — [chalk/chalk](https://github.com/chalk/chalk) — MIT
- **express-basic-auth** — [LionC/express-basic-auth](https://github.com/LionC/express-basic-auth) — MIT
- **dotenv** — [motdotla/dotenv](https://github.com/motdotla/dotenv) — BSD-2-Clause

### Fonts & Icons
- **Font Awesome** — [fontawesome.com](https://fontawesome.com) — Free (CC BY 4.0 / MIT)
- **Inter** — [rsms/inter](https://github.com/rsms/inter) — OFL-1.1
- **Poppins** — OFL-1.1

## License

This project is licensed under the **GNU Affero General Public License v3.0**,
inherited from Interstellar. See [LICENSE](./LICENSE) for the full text.
