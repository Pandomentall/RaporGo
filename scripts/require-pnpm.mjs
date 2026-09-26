/**
 * Bu depo pnpm workspace'i: bağımlılıklar `workspace:*` protokolüyle tanımlı ve
 * paket listesi pnpm-workspace.yaml'da. npm bunların ikisini de tanımadığı için
 * `npm install` node_modules'ü sessizce bozar. Sessiz bozulma yerine burada
 * duruyoruz.
 */
const agent = process.env.npm_config_user_agent ?? '';
const execPath = process.env.npm_execpath ?? '';

if (!/\bpnpm\b/.test(agent) && !/pnpm/.test(execPath)) {
  console.error(`
  Bu depo pnpm kullanıyor, npm ya da yarn değil.

    pnpm install        bağımlılıklar
    pnpm dev            masaüstü editörü
    pnpm test           testler

  pnpm kurulu değilse:  npm install -g pnpm
`);
  process.exit(1);
}
