#!/usr/bin/env node

import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import inquirer from "inquirer";
import { log, getCurrentIP, getCurrentIPv6, loadLastIP, saveCurrentIP } from "./utils.js";
import chalk from "chalk";
import figlet from "figlet";
import Table from "cli-table3";
import ora from "ora";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "config.json");
const UPDATE_CACHE_PATH = path.resolve(__dirname, ".update-check");
const API_BASE = "https://api.apertodns.com/api";

// Leggi versione da package.json
const getPackageVersion = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
};

const CURRENT_VERSION = getPackageVersion();
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 ore in ms

// Confronto semver robusto
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

// Check aggiornamenti con cache
const checkForUpdates = async () => {
  try {
    // Controlla cache
    if (fs.existsSync(UPDATE_CACHE_PATH)) {
      const cache = JSON.parse(fs.readFileSync(UPDATE_CACHE_PATH, "utf-8"));
      const cacheAge = Date.now() - (cache.timestamp || 0);

      // Se cache recente, usa il risultato cachato
      if (cacheAge < UPDATE_CHECK_INTERVAL) {
        if (cache.latestVersion && compareVersions(cache.latestVersion, CURRENT_VERSION) > 0) {
          return cache.latestVersion;
        }
        return null;
      }
    }

    // Fetch da npm registry
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("https://registry.npmjs.org/apertodns/latest", {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const latestVersion = data.version;

    // Salva in cache
    fs.writeFileSync(UPDATE_CACHE_PATH, JSON.stringify({
      timestamp: Date.now(),
      latestVersion,
      checkedVersion: CURRENT_VERSION
    }));

    // Confronta versioni
    if (latestVersion && compareVersions(latestVersion, CURRENT_VERSION) > 0) {
      return latestVersion;
    }
    return null;
  } catch {
    return null; // Silenzioso se offline o errore
  }
};

// Colors
const orange = chalk.hex('#f97316');
const green = chalk.hex('#22c55e');
const red = chalk.hex('#ef4444');
const blue = chalk.hex('#3b82f6');
const purple = chalk.hex('#a855f7');
const yellow = chalk.hex('#eab308');
const gray = chalk.hex('#71717a');
const cyan = chalk.hex('#06b6d4');

const showBanner = async () => {
  console.clear();
  const banner = figlet.textSync("ApertoDNS", { font: "Standard" });
  console.log(orange(banner));
  console.log(gray("  ╔════════════════════════════════════════════════════════╗"));
  console.log(gray("  ║") + cyan(`  ApertoDNS CLI v${CURRENT_VERSION}`) + gray(" - Dynamic DNS Reinvented      ║"));
  console.log(gray("  ║") + gray("  Gestisci domini, token e DNS dalla tua shell.        ║"));
  console.log(gray("  ╚════════════════════════════════════════════════════════╝\n"));

  // Check aggiornamenti in background
  const newVersion = await checkForUpdates();
  if (newVersion) {
    console.log(yellow("  ╔════════════════════════════════════════════════════════╗"));
    console.log(yellow("  ║") + red("  ⚠️  Nuova versione disponibile: ") + green.bold(`v${newVersion}`) + yellow("                  ║"));
    console.log(yellow("  ║") + gray(`     Tu hai: v${CURRENT_VERSION}`) + yellow("                                      ║"));
    console.log(yellow("  ║") + cyan("     Aggiorna: ") + chalk.white("npm update -g apertodns-cli") + yellow("           ║"));
    console.log(yellow("  ╚════════════════════════════════════════════════════════╝\n"));
  }
};

const promptInput = (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
};

// Parse args
const args = process.argv.slice(2);
const isCron = args.includes("--cron");
if (isCron) {
  process.argv.push("--quiet");
  process.argv.push("--json");
}

const isQuiet = args.includes("--quiet");
const showHelp = args.includes("--help");
const showVersion = args.includes("--version");
const showJson = args.includes("--json");
const runVerify = args.includes("--verify");
const runSetup = args.includes("--setup");
const showStatus = args.includes("--status") || args.includes("--show");
const forceUpdate = args.includes("--force");
const enableTokenId = args.includes("--enable") ? args[args.indexOf("--enable") + 1] : null;
const disableTokenId = args.includes("--disable") ? args[args.indexOf("--disable") + 1] : null;
const toggleTokenId = args.includes("--toggle") ? args[args.indexOf("--toggle") + 1] : null;
const runConfigEdit = args.includes("--config");
const listDomains = args.includes("--domains");
const listTokens = args.includes("--tokens");
const addDomainArg = args.includes("--add-domain") ? args[args.indexOf("--add-domain") + 1] : null;
const deleteDomainArg = args.includes("--delete-domain") ? args[args.indexOf("--delete-domain") + 1] : null;
const showStats = args.includes("--stats");
const showLogs = args.includes("--logs");
const testDns = args.includes("--test") ? args[args.indexOf("--test") + 1] : null;
const showDashboard = args.includes("--dashboard");
const listWebhooks = args.includes("--webhooks");
const listApiKeys = args.includes("--api-keys");
const runInteractive = args.length === 0;

// Show help
if (showHelp) {
  console.log(`
${orange.bold("ApertoDNS CLI")} - Gestisci il tuo DNS dinamico

${chalk.bold("USAGE:")}
  apertodns [command] [options]

${chalk.bold("COMANDI PRINCIPALI:")}
  ${cyan("--dashboard")}          Dashboard completa con tutte le info
  ${cyan("--domains")}            Lista tutti i tuoi domini (tabella)
  ${cyan("--tokens")}             Lista tutti i tuoi token (tabella)
  ${cyan("--stats")}              Statistiche e metriche
  ${cyan("--logs")}               Ultimi log di attività

${chalk.bold("GESTIONE DOMINI:")}
  ${cyan("--add-domain")} <name>  Crea un nuovo dominio
  ${cyan("--delete-domain")}      Elimina un dominio (interattivo)
  ${cyan("--test")} <domain>      Testa risoluzione DNS di un dominio

${chalk.bold("GESTIONE TOKEN:")}
  ${cyan("--enable")} <id>        Attiva un token
  ${cyan("--disable")} <id>       Disattiva un token
  ${cyan("--toggle")} <id>        Inverte stato token (ON/OFF)
  ${cyan("--verify")}             Verifica validità token

${chalk.bold("INTEGRAZIONI:")}
  ${cyan("--webhooks")}           Lista webhook configurati
  ${cyan("--api-keys")}           Lista API keys

${chalk.bold("CONFIGURAZIONE:")}
  ${cyan("--setup")}              Configurazione guidata (login/registrazione)
  ${cyan("--status")}             Mostra stato attuale
  ${cyan("--config")}             Modifica configurazione
  ${cyan("--force")}              Forza aggiornamento DNS

${chalk.bold("OPZIONI:")}
  ${cyan("--cron")}               Modalità silenziosa per cronjob
  ${cyan("--quiet")}              Nasconde banner
  ${cyan("--json")}               Output JSON
  ${cyan("--version")}            Mostra versione
  ${cyan("--help")}               Mostra questo help

${chalk.bold("MODALITÀ INTERATTIVA:")}
  Esegui ${cyan("apertodns")} senza argomenti per il menu interattivo.

${gray("Esempi:")}
  ${gray("$")} apertodns --dashboard
  ${gray("$")} apertodns --domains
  ${gray("$")} apertodns --add-domain mioserver.apertodns.com
  ${gray("$")} apertodns --test mioserver.apertodns.com
  ${gray("$")} apertodns --stats
`);
  process.exit(0);
}

if (showVersion) {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
  console.log(`ApertoDNS CLI v${pkg.version}`);
  process.exit(0);
}

if (!isQuiet && !isCron) showBanner();

// Load config
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch (err) {
    console.error(red("Errore lettura config.json:"), err.message);
  }
}

// Helper: get JWT token (per API: domains, tokens, dashboard...)
const getAuthToken = async () => {
  if (config.jwtToken) return config.jwtToken;
  if (config.apiToken) return config.apiToken; // backward compatibility
  return await promptInput(cyan("🔑 Token JWT: "));
};

// Helper: get CLI token (per DDNS: status, force, update...)
const getCliToken = async () => {
  if (config.cliToken) return config.cliToken;
  if (config.apiToken) return config.apiToken; // backward compatibility
  return await promptInput(cyan("🔑 Token CLI: "));
};

// Helper: create spinner
const spinner = (text) => ora({ text, spinner: "dots", color: "yellow" });

// ==================== DOMAINS ====================

const fetchDomains = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento domini...").start();
  try {
    const res = await fetch(`${API_BASE}/domains`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    spin.stop();
    if (!res.ok) throw new Error("Errore fetch domini");
    return await res.json();
  } catch (err) {
    spin.fail("Errore caricamento domini");
    return [];
  }
};

const showDomainsList = async () => {
  const domains = await fetchDomains();
  if (domains.length === 0) {
    console.log(yellow("\n⚠️  Nessun dominio trovato.\n"));
    return;
  }

  const table = new Table({
    head: [
      gray('STATO'),
      orange.bold('DOMINIO'),
      cyan('IP ATTUALE'),
      gray('TTL'),
      gray('ULTIMO UPDATE')
    ],
    style: { head: [], border: ['gray'] },
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    }
  });

  domains.forEach(d => {
    const status = d.currentIp ? green('● ONLINE') : red('● OFFLINE');
    const lastUpdate = d.lastUpdated
      ? new Date(d.lastUpdated).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : gray('Mai');

    table.push([
      status,
      chalk.bold(d.name),
      d.currentIp || gray('N/D'),
      `${d.ttl}s`,
      lastUpdate
    ]);
  });

  console.log(`\n📋 ${chalk.bold('I tuoi domini')} (${domains.length})\n`);
  console.log(table.toString());
  console.log();
};

const addDomain = async (name) => {
  const token = await getAuthToken();
  const domainName = name || await promptInput(cyan("📝 Nome dominio (es. mioserver.apertodns.com): "));

  if (!domainName) {
    console.log(red("Nome dominio richiesto."));
    return;
  }

  const spin = spinner(`Creazione dominio ${domainName}...`).start();
  try {
    const res = await fetch(`${API_BASE}/domains/standard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: domainName })
    });
    const data = await res.json();

    if (res.ok) {
      spin.succeed(`Dominio "${domainName}" creato!`);
      if (data.token) {
        console.log(yellow("\n🔐 Token generato:"), chalk.bold.white(data.token));
        console.log(gray("   (Salvalo subito, non sarà più visibile)\n"));
      }
    } else {
      spin.fail(`Errore: ${data.error || data.message}`);
    }
  } catch (err) {
    spin.fail(err.message);
  }
};

const deleteDomain = async (name) => {
  const token = await getAuthToken();
  const domains = await fetchDomains();

  let domainName = name;
  if (!domainName) {
    if (domains.length === 0) {
      console.log(yellow("Nessun dominio da eliminare."));
      return;
    }
    const { selected } = await inquirer.prompt([{
      type: "list",
      name: "selected",
      message: "Quale dominio vuoi eliminare?",
      choices: domains.map(d => ({
        name: `${d.currentIp ? green('●') : red('●')} ${d.name}`,
        value: d.name
      }))
    }]);
    domainName = selected;
  }

  const domain = domains.find(d => d.name === domainName);
  if (!domain) {
    console.log(red(`Dominio "${domainName}" non trovato.`));
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: red(`⚠️  Eliminare definitivamente "${domainName}"?`),
    default: false
  }]);

  if (!confirm) {
    console.log(gray("Operazione annullata."));
    return;
  }

  const spin = spinner(`Eliminazione ${domainName}...`).start();
  try {
    const res = await fetch(`${API_BASE}/domains/${domain.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      spin.succeed(`Dominio "${domainName}" eliminato.`);
    } else {
      const data = await res.json();
      spin.fail(`Errore: ${data.error || data.message}`);
    }
  } catch (err) {
    spin.fail(err.message);
  }
};

// ==================== DNS TEST ====================

const testDnsResolution = async (domain) => {
  const domainToTest = domain || await promptInput(cyan("🌐 Dominio da testare: "));
  if (!domainToTest) return;

  // Validazione dominio per prevenire command injection
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/;
  if (!domainRegex.test(domainToTest) || domainToTest.includes('..')) {
    console.log(red("\n❌ Nome dominio non valido.\n"));
    return;
  }

  const spin = spinner(`Testing DNS per ${domainToTest}...`).start();

  try {
    const { execFileSync } = await import('child_process');
    const result = execFileSync('dig', ['+short', domainToTest, 'A'], { encoding: 'utf-8' }).trim();
    const result6 = execFileSync('dig', ['+short', domainToTest, 'AAAA'], { encoding: 'utf-8' }).trim();

    spin.stop();
    console.log(`\n🔍 ${chalk.bold('Risultati DNS per')} ${cyan(domainToTest)}\n`);

    const table = new Table({
      style: { head: [], border: ['gray'] }
    });

    table.push(
      [gray('Record A (IPv4)'), result || red('Non trovato')],
      [gray('Record AAAA (IPv6)'), result6 || gray('Non configurato')]
    );

    console.log(table.toString());

    // Propagation check
    console.log(`\n${gray('Propagazione DNS:')}`);
    const dnsServers = ['8.8.8.8', '1.1.1.1'];
    for (const dns of dnsServers) {
      try {
        const check = execFileSync('dig', ['+short', `@${dns}`, domainToTest, 'A'], { encoding: 'utf-8' }).trim();
        console.log(`   ${dns}: ${check ? green('✓ ' + check) : red('✗ Non trovato')}`);
      } catch {
        console.log(`   ${dns}: ${red('✗ Errore')}`);
      }
    }
    console.log();
  } catch (err) {
    spin.fail("Errore nel test DNS");
    console.log(gray("   (Assicurati che 'dig' sia installato)\n"));
  }
};

// ==================== TOKENS ====================

const fetchTokens = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento token...").start();
  try {
    const res = await fetch(`${API_BASE}/tokens`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    spin.stop();
    if (!res.ok) throw new Error("Errore fetch token");
    return await res.json();
  } catch (err) {
    spin.fail("Errore caricamento token");
    return [];
  }
};

const showTokensList = async () => {
  const tokens = await fetchTokens();
  if (tokens.length === 0) {
    console.log(yellow("\n⚠️  Nessun token trovato.\n"));
    return;
  }

  const table = new Table({
    head: [
      gray('STATO'),
      orange.bold('ETICHETTA'),
      cyan('DOMINIO'),
      gray('ID'),
      gray('ULTIMO USO')
    ],
    style: { head: [], border: ['gray'] }
  });

  tokens.forEach(t => {
    const status = t.active ? green('● ATTIVO') : red('● OFF');
    const lastUsed = t.lastUsed
      ? new Date(t.lastUsed).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : gray('Mai');

    table.push([
      status,
      chalk.bold(t.label || 'N/D'),
      t.domain?.name || gray('N/D'),
      gray(t.id),
      lastUsed
    ]);
  });

  console.log(`\n🔑 ${chalk.bold('I tuoi token')} (${tokens.length})\n`);
  console.log(table.toString());
  console.log();
};

const updateTokenState = async (tokenId, desiredState = null) => {
  const apiToken = await getAuthToken();
  if (!tokenId) {
    console.error(red("Devi specificare un tokenId"));
    return;
  }

  let finalState = desiredState;
  if (desiredState === null) {
    const spin = spinner("Caricamento...").start();
    const res = await fetch(`${API_BASE}/tokens`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    });
    const all = await res.json();
    spin.stop();

    const token = all.find(t => t.id === parseInt(tokenId));
    if (!token) {
      console.error(red(`Token ID ${tokenId} non trovato.`));
      return;
    }
    finalState = !token.active;
  }

  const spin = spinner(`${finalState ? 'Attivazione' : 'Disattivazione'} token...`).start();
  const res = await fetch(`${API_BASE}/tokens/${tokenId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`
    },
    body: JSON.stringify({ active: finalState })
  });

  if (res.ok) {
    spin.succeed(`Token ${tokenId} ${finalState ? green('attivato') : red('disattivato')}`);
  } else {
    const data = await res.json();
    spin.fail(`Errore: ${data.error || data.message}`);
  }
};

// ==================== STATS ====================

const showStatsCommand = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento statistiche...").start();

  try {
    const [domainsRes, tokensRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/domains`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/tokens`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/stats/daily?days=7`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    ]);

    const domains = await domainsRes.json();
    const tokens = await tokensRes.json();
    const stats = statsRes?.ok ? await statsRes.json() : [];

    spin.stop();

    console.log(`\n📊 ${chalk.bold('Statistiche ApertoDNS')}\n`);

    // Summary boxes
    const box1 = `┌─────────────────┐
│ ${orange.bold(String(domains.length).padStart(2))} Domini     │
└─────────────────┘`;

    const box2 = `┌─────────────────┐
│ ${green.bold(String(tokens.filter(t => t.active).length).padStart(2))} Token attivi│
└─────────────────┘`;

    const box3 = `┌─────────────────┐
│ ${cyan.bold(String(domains.filter(d => d.currentIp).length).padStart(2))} Online      │
└─────────────────┘`;

    console.log(gray(box1.split('\n')[0] + '  ' + box2.split('\n')[0] + '  ' + box3.split('\n')[0]));
    console.log(gray(box1.split('\n')[1] + '  ' + box2.split('\n')[1] + '  ' + box3.split('\n')[1]));
    console.log(gray(box1.split('\n')[2] + '  ' + box2.split('\n')[2] + '  ' + box3.split('\n')[2]));

    // Weekly chart
    if (stats.length > 0) {
      console.log(`\n${gray('Aggiornamenti ultimi 7 giorni:')}`);
      const maxUpdates = Math.max(...stats.map(s => s.updates || 0), 1);

      stats.forEach(day => {
        const barLength = Math.round((day.updates || 0) / maxUpdates * 20);
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        const date = new Date(day.date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' });
        console.log(`   ${gray(date)} ${orange(bar)} ${day.updates || 0}`);
      });
    }

    console.log();
  } catch (err) {
    spin.fail("Errore caricamento statistiche");
  }
};

// ==================== LOGS ====================

const showLogsCommand = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento log...").start();

  try {
    const res = await fetch(`${API_BASE}/logs?limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Errore fetch logs");
    const data = await res.json();
    const logs = data.logs || data;

    spin.stop();

    if (logs.length === 0) {
      console.log(yellow("\n⚠️  Nessun log recente.\n"));
      return;
    }

    console.log(`\n📜 ${chalk.bold('Ultimi log')}\n`);

    logs.forEach(l => {
      const time = new Date(l.createdAt).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const actionColor = l.action === 'UPDATE' ? green :
                         l.action === 'CREATE' ? blue :
                         l.action === 'DELETE' ? red : gray;

      console.log(`   ${gray(time)} ${actionColor(l.action.padEnd(8))} ${l.token?.label || 'N/D'} ${gray('→')} ${l.token?.domain?.name || 'N/D'}`);
    });

    console.log();
  } catch (err) {
    spin.fail("Errore caricamento log");
  }
};

// ==================== WEBHOOKS ====================

const showWebhooksList = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento webhook...").start();

  try {
    const res = await fetch(`${API_BASE}/webhooks`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Errore fetch webhooks");
    const webhooks = await res.json();

    spin.stop();

    if (webhooks.length === 0) {
      console.log(yellow("\n⚠️  Nessun webhook configurato.\n"));
      return;
    }

    const table = new Table({
      head: [gray('STATO'), purple.bold('URL'), gray('EVENTI'), gray('DOMINIO')],
      style: { head: [], border: ['gray'] }
    });

    webhooks.forEach(w => {
      const status = w.active ? green('● ON') : red('● OFF');
      const url = w.url.length > 40 ? w.url.substring(0, 37) + '...' : w.url;
      table.push([status, url, w.events?.join(', ') || 'ALL', w.domain?.name || 'Tutti']);
    });

    console.log(`\n🔗 ${chalk.bold('Webhooks')} (${webhooks.length})\n`);
    console.log(table.toString());
    console.log();
  } catch (err) {
    spin.fail("Errore caricamento webhooks");
  }
};

// ==================== API KEYS ====================

const showApiKeysList = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento API keys...").start();

  try {
    const res = await fetch(`${API_BASE}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Errore fetch API keys");
    const keys = await res.json();

    spin.stop();

    if (keys.length === 0) {
      console.log(yellow("\n⚠️  Nessuna API key trovata.\n"));
      return;
    }

    const table = new Table({
      head: [gray('STATO'), blue.bold('NOME'), gray('PREFIX'), gray('SCOPES'), gray('RATE')],
      style: { head: [], border: ['gray'] }
    });

    keys.forEach(k => {
      const status = k.active ? green('● ON') : red('● OFF');
      const scopes = k.scopes?.length > 3 ? `${k.scopes.length} scopes` : k.scopes?.join(', ') || 'N/D';
      table.push([status, chalk.bold(k.name), gray(k.keyPrefix + '...'), scopes, `${k.rateLimit}/h`]);
    });

    console.log(`\n🔐 ${chalk.bold('API Keys')} (${keys.length})\n`);
    console.log(table.toString());
    console.log();
  } catch (err) {
    spin.fail("Errore caricamento API keys");
  }
};

// ==================== DASHBOARD ====================

const showDashboardCommand = async () => {
  const token = await getAuthToken();
  const spin = spinner("Caricamento dashboard...").start();

  try {
    const [domainsRes, tokensRes, ipRes] = await Promise.all([
      fetch(`${API_BASE}/domains`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_BASE}/tokens`, { headers: { Authorization: `Bearer ${token}` } }),
      getCurrentIP('https://api.ipify.org').catch(() => 'N/D')
    ]);

    const domains = await domainsRes.json();
    const tokens = await tokensRes.json();

    spin.stop();

    console.log(`\n${orange.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    console.log(`${orange.bold('                         DASHBOARD                           ')}`);
    console.log(`${orange.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n`);

    // Current IP
    console.log(`  🌐 ${gray('IP Attuale:')} ${green.bold(ipRes)}`);
    console.log();

    // Stats row
    const onlineDomains = domains.filter(d => d.currentIp).length;
    const activeTokens = tokens.filter(t => t.active).length;

    console.log(`  ┌──────────────┬──────────────┬──────────────┬──────────────┐`);
    console.log(`  │ ${orange.bold('DOMINI')}       │ ${green.bold('ONLINE')}       │ ${cyan.bold('TOKEN')}        │ ${purple.bold('ATTIVI')}       │`);
    console.log(`  │     ${chalk.bold(String(domains.length).padStart(3))}      │     ${chalk.bold(String(onlineDomains).padStart(3))}      │     ${chalk.bold(String(tokens.length).padStart(3))}      │     ${chalk.bold(String(activeTokens).padStart(3))}      │`);
    console.log(`  └──────────────┴──────────────┴──────────────┴──────────────┘`);
    console.log();

    // Domains preview
    if (domains.length > 0) {
      console.log(`  ${gray('Ultimi domini:')}`);
      domains.slice(0, 5).forEach(d => {
        const status = d.currentIp ? green('●') : red('●');
        console.log(`   ${status} ${chalk.bold(d.name)} ${gray('→')} ${d.currentIp || gray('N/D')}`);
      });
      if (domains.length > 5) console.log(`   ${gray(`... e altri ${domains.length - 5}`)}`);
    }

    console.log();
    console.log(`  ${gray('─'.repeat(60))}`);
    console.log(`  ${gray('Usa')} ${cyan('--help')} ${gray('per vedere tutti i comandi disponibili')}`);
    console.log();
  } catch (err) {
    spin.fail("Errore caricamento dashboard");
  }
};

// ==================== EXISTING FUNCTIONS ====================

const fetchRemoteConfig = async (token) => {
  try {
    const res = await fetch(`${API_BASE}/cli-config/from-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!res.ok || !data.config || !data.config.id) throw new Error(data.error || "Configurazione non valida");
    return data.config;
  } catch (err) {
    return null;
  }
};

const setup = async () => {
  console.log(cyan("\n🔧 Configurazione ApertoDNS CLI\n"));

  const { hasAccount } = await inquirer.prompt([{
    type: "list",
    name: "hasAccount",
    message: "Seleziona un'opzione:",
    choices: [
      { name: green('🔓 Ho già un account - Login'), value: true },
      { name: blue('📝 Sono nuovo - Registrati sul sito'), value: false }
    ]
  }]);

  let apiToken;

  if (hasAccount) {
    const { email, password } = await inquirer.prompt([
      { type: "input", name: "email", message: "📧 Email:" },
      { type: "password", name: "password", message: "🔑 Password:", mask: "●" }
    ]);

    const spin = spinner("Login in corso...").start();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok || !data.cliToken) {
      spin.fail("Login fallito: " + (data.message || "Errore"));
      return;
    }
    apiToken = data.cliToken;
    spin.succeed("Login effettuato!");
  } else {
    // Registrazione solo via web per sicurezza (captcha)
    console.log(cyan("\n📝 Per registrarti, visita: ") + orange.bold("https://apertodns.com/register"));
    console.log(gray("   Dopo la registrazione, torna qui per fare il login.\n"));
    return;
  }

  const remoteConfig = await fetchRemoteConfig(apiToken);
  config = remoteConfig ? { ...remoteConfig, apiToken } : { apiToken };

  const { save } = await inquirer.prompt([{
    type: "confirm",
    name: "save",
    message: "💾 Salvare la configurazione su questo computer?",
    default: true
  }]);

  if (save) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(green(`\n✅ Configurazione salvata!`));
    console.log(yellow("⚠️  Non condividere config.json - contiene il tuo token.\n"));
  }
};

const verifyToken = async () => {
  const apiToken = await promptInput(cyan("🔍 Token da verificare: "));
  const spin = spinner("Verifica in corso...").start();

  try {
    const res = await fetch(`${API_BASE}/tokens/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: apiToken })
    });
    const data = await res.json();

    if (data.valid) {
      spin.succeed("Token valido!");
      console.log(`   ${gray('Etichetta:')} ${data.label}`);
      console.log(`   ${gray('Creato:')} ${new Date(data.createdAt).toLocaleString("it-IT")}\n`);
    } else {
      spin.fail("Token non valido");
    }
  } catch (err) {
    spin.fail("Errore nella verifica");
  }
};

const showCurrentStatus = async () => {
  const cliToken = await getCliToken();
  const spin = spinner("Caricamento stato...").start();

  const remote = await fetchRemoteConfig(cliToken);
  if (!remote) {
    spin.fail("Impossibile caricare la configurazione");
    return;
  }

  const currentIP = await getCurrentIP(remote.ipService).catch(() => null);
  const lastIP = loadLastIP();

  spin.stop();

  console.log(`\n📊 ${chalk.bold('Stato Attuale')}\n`);

  const table = new Table({ style: { border: ['gray'] } });
  table.push(
    [gray('Dominio'), cyan.bold(remote.domain)],
    [gray('TTL'), `${remote.ttl}s`],
    [gray('IP Attuale'), green.bold(currentIP || 'N/D')],
    [gray('Ultimo IP'), lastIP || gray('N/D')],
    [gray('IPv6'), remote.useIPv6 ? green('Attivo') : gray('Disattivo')]
  );

  console.log(table.toString());
  console.log();
};

const editConfig = async () => {
  const apiToken = await getAuthToken();
  const remote = await fetchRemoteConfig(apiToken);
  if (!remote) {
    console.log(red("Impossibile caricare la configurazione."));
    return;
  }

  const answers = await inquirer.prompt([
    { type: "input", name: "ttl", message: "⏱️  TTL (secondi):", default: String(remote.ttl) },
    { type: "input", name: "ipService", message: "🌐 Servizio IP:", default: remote.ipService },
    { type: "confirm", name: "useIPv6", message: "6️⃣  Usare IPv6?", default: remote.useIPv6 }
  ]);

  const spin = spinner("Salvataggio...").start();
  const res = await fetch(`${API_BASE}/cli-config/${remote.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      ttl: parseInt(answers.ttl),
      ipService: answers.ipService,
      useIPv6: answers.useIPv6
    })
  });

  if (res.ok) {
    spin.succeed("Configurazione aggiornata!");
    config = { ...remote, ...answers, apiToken };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } else {
    const data = await res.json();
    spin.fail("Errore: " + (data.error || data.message));
  }
};

const runUpdate = async () => {
  let apiToken = config.apiToken;
  if (!apiToken) {
    apiToken = await promptInput(cyan("🔑 Token API: "));
    const remoteConfig = await fetchRemoteConfig(apiToken);
    if (!remoteConfig) {
      console.log(red("Configurazione non trovata."));
      return;
    }
    config = { ...remoteConfig, apiToken };
  }

  const spin = spinner("Rilevamento IP...").start();
  const currentIP = await getCurrentIP(config.ipService).catch(() => null);
  const currentIPv6 = config.useIPv6 ? await getCurrentIPv6(config.ipv6Service).catch(() => null) : null;

  if (!currentIP && !currentIPv6) {
    spin.fail("Nessun IP rilevato");
    return;
  }

  spin.text = `IP rilevato: ${currentIP}`;

  const lastIP = loadLastIP();
  if (!forceUpdate && lastIP === currentIP) {
    spin.succeed(`IP invariato (${currentIP})`);
    return;
  }

  spin.text = `Aggiornamento DNS per ${config.domain}...`;

  const body = {
    name: config.domain,
    ip: currentIP,
    ttl: config.ttl,
  };
  if (currentIPv6) body.ipv6 = currentIPv6;

  const res = await fetch(`${API_BASE}/update-dns`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.ok && data.results) {
    saveCurrentIP(currentIP);
    spin.succeed(`DNS aggiornato! ${config.domain} → ${currentIP}`);
    if (showJson) console.log(JSON.stringify(data.results[0], null, 2));
  } else {
    spin.fail(`Errore: ${data.error || data.details}`);
  }
};

// ==================== INTERACTIVE MODE ====================

const interactiveMode = async () => {
  console.log(gray("  Premi Ctrl+C per uscire\n"));

  while (true) {
    const { action } = await inquirer.prompt([{
      type: "list",
      name: "action",
      message: orange("Cosa vuoi fare?"),
      pageSize: 15,
      choices: [
        { name: `${orange('📊')} Dashboard`, value: "dashboard" },
        new inquirer.Separator(gray('─── Domini ───')),
        { name: `${cyan('📋')} Lista domini`, value: "domains" },
        { name: `${green('➕')} Aggiungi dominio`, value: "add-domain" },
        { name: `${red('🗑️ ')} Elimina dominio`, value: "delete-domain" },
        { name: `${blue('🔍')} Test DNS`, value: "test-dns" },
        new inquirer.Separator(gray('─── Token ───')),
        { name: `${purple('🔑')} Lista token`, value: "tokens" },
        { name: `${yellow('🔄')} Toggle token`, value: "toggle-token" },
        new inquirer.Separator(gray('─── Altro ───')),
        { name: `${cyan('📈')} Statistiche`, value: "stats" },
        { name: `${gray('📜')} Log attività`, value: "logs" },
        { name: `${purple('🔗')} Webhooks`, value: "webhooks" },
        { name: `${blue('🔐')} API Keys`, value: "api-keys" },
        new inquirer.Separator(gray('─── Config ───')),
        { name: `${gray('📊')} Stato attuale`, value: "status" },
        { name: `${green('🔄')} Aggiorna DNS`, value: "update" },
        { name: `${yellow('⚙️ ')} Configurazione`, value: "config" },
        { name: `${blue('🔧')} Setup`, value: "setup" },
        new inquirer.Separator(),
        { name: red("❌ Esci"), value: "exit" }
      ]
    }]);

    console.log();

    switch (action) {
      case "dashboard": await showDashboardCommand(); break;
      case "domains": await showDomainsList(); break;
      case "add-domain": await addDomain(); break;
      case "delete-domain": await deleteDomain(); break;
      case "test-dns": await testDnsResolution(); break;
      case "tokens": await showTokensList(); break;
      case "toggle-token":
        const tokens = await fetchTokens();
        if (tokens.length === 0) {
          console.log(yellow("Nessun token disponibile."));
          break;
        }
        const { tokenId } = await inquirer.prompt([{
          type: "list",
          name: "tokenId",
          message: "Seleziona token:",
          choices: tokens.map(t => ({
            name: `${t.active ? green('●') : red('●')} ${t.label} ${gray('→')} ${t.domain?.name || 'N/D'}`,
            value: t.id
          }))
        }]);
        await updateTokenState(tokenId, null);
        break;
      case "stats": await showStatsCommand(); break;
      case "logs": await showLogsCommand(); break;
      case "webhooks": await showWebhooksList(); break;
      case "api-keys": await showApiKeysList(); break;
      case "status": await showCurrentStatus(); break;
      case "update": await runUpdate(); break;
      case "config": await editConfig(); break;
      case "setup": await setup(); break;
      case "exit":
        console.log(gray("Arrivederci! 👋\n"));
        process.exit(0);
    }

    console.log();
  }
};

// ==================== MAIN ====================

const main = async () => {
  try {
    if (enableTokenId) await updateTokenState(enableTokenId, true);
    else if (disableTokenId) await updateTokenState(disableTokenId, false);
    else if (toggleTokenId) await updateTokenState(toggleTokenId, null);
    else if (showDashboard) await showDashboardCommand();
    else if (listDomains) await showDomainsList();
    else if (addDomainArg) await addDomain(addDomainArg);
    else if (deleteDomainArg) await deleteDomain(deleteDomainArg);
    else if (testDns) await testDnsResolution(testDns);
    else if (listTokens) await showTokensList();
    else if (showStats) await showStatsCommand();
    else if (showLogs) await showLogsCommand();
    else if (listWebhooks) await showWebhooksList();
    else if (listApiKeys) await showApiKeysList();
    else if (runSetup) await setup();
    else if (runVerify) await verifyToken();
    else if (showStatus) await showCurrentStatus();
    else if (runConfigEdit) await editConfig();
    else if (runInteractive) await interactiveMode();
    else await runUpdate();
  } catch (err) {
    if (err.message !== 'User force closed the prompt') {
      console.error(red("\n❌ Errore:"), err.message);
    }
    process.exit(1);
  }
};

main();
