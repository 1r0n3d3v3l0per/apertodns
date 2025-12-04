# ApertoDNS

[![npm version](https://img.shields.io/npm/v/apertodns.svg)](https://www.npmjs.com/package/apertodns)
[![license](https://img.shields.io/npm/l/apertodns.svg)](https://github.com/apertonetwork/apertodns/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/apertodns.svg)](https://nodejs.org)

**Dynamic DNS management from your terminal.** Manage domains, tokens, and DNS updates with style.

ApertoDNS is a free Dynamic DNS service that lets you point a subdomain to your dynamic IP address. Perfect for home servers, IoT devices, game servers, and remote access.

## Features

- **Easy Setup** - Login or register directly from CLI
- **Multiple Domains** - Manage unlimited subdomains
- **Auto Updates** - Set up cron for automatic IP updates
- **Interactive Mode** - Beautiful terminal UI with menus
- **IPv4 & IPv6** - Full dual-stack support
- **Real-time Stats** - View usage statistics and logs

## Requirements

- Node.js 18.0.0 or higher
- An ApertoDNS account ([register free](https://apertodns.com))

## Installation

```bash
npm install -g apertodns
```

## Quick Start

```bash
# 1. Setup (login or register)
apertodns --setup

# 2. View your dashboard
apertodns --dashboard

# 3. List your domains
apertodns --domains

# 4. Force DNS update
apertodns --force
```

## Commands

### Main Commands

| Command | Description |
|---------|-------------|
| `--dashboard` | Complete dashboard with all info |
| `--domains` | List all your domains |
| `--tokens` | List all your tokens |
| `--stats` | Statistics and metrics |
| `--logs` | Recent activity logs |

### Domain Management

| Command | Description |
|---------|-------------|
| `--add-domain <name>` | Create a new subdomain |
| `--delete-domain` | Delete a domain (interactive) |
| `--test <domain>` | Test DNS resolution |

### Token Management

| Command | Description |
|---------|-------------|
| `--enable <id>` | Enable a token |
| `--disable <id>` | Disable a token |
| `--toggle <id>` | Toggle token state |
| `--verify` | Verify token validity |

### Configuration

| Command | Description |
|---------|-------------|
| `--setup` | Guided setup (login/register) |
| `--status` | Show current status and IP |
| `--force` | Force DNS update now |
| `--cron` | Silent mode for cron jobs |

## Interactive Mode

Run `apertodns` without arguments for an interactive menu with all options.

```bash
apertodns
```

## Automatic Updates (Cron)

Set up automatic IP updates with cron:

```bash
# Update every 5 minutes
*/5 * * * * /usr/local/bin/apertodns --cron >> /var/log/apertodns.log 2>&1

# Or every minute for faster updates
* * * * * /usr/local/bin/apertodns --cron
```

Find your apertodns path with: `which apertodns`

## Router Integration (DynDNS2)

ApertoDNS is compatible with routers that support DynDNS2 protocol:

```
Server: api.apertodns.com
Protocol: DynDNS2
Username: your-token
Password: your-token
Hostname: yourdomain.apertodns.com
```

## Links

- **Website**: [apertodns.com](https://apertodns.com)
- **Dashboard**: [apertodns.com/dashboard](https://apertodns.com/dashboard)
- **API Docs**: [apertodns.com/docs](https://apertodns.com/docs)
- **Issues**: [GitHub Issues](https://github.com/1r0n3d3v3l0per/apertodns/issues)

## Support

Need help?
- Open an issue on [GitHub](https://github.com/1r0n3d3v3l0per/apertodns/issues)
- Email: support@apertodns.com

## License

MIT - [Aperto Network](https://apertodns.com)
