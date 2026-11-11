# Bondan's Bistro — MCP Service Guide

Connect your AI agent (Claude Code, Cursor, or any MCP client) to our **Odoo 20 restaurant simulation** and let it analyze 3 months of realistic business data: sales, P&L, inventory, staff, and… a few secrets to discover.

---

## 1. What is this?

A **read-only MCP service** exposing the "Bondan's Bistro" dataset — a NYC × Southeast Asian fusion restaurant in SoHo, simulated end-to-end in Odoo 20 (Community):

- **~3,000 POS orders** across 15 weekly sessions (Aug 11 – Nov 11, 2026)
- Full accounting: rent, payroll, marketing, COGS, recurring bills
- Menu performance: 15 dishes — viral hits, flops, one retired item
- HR: 6 employees, one departure, one promotion, one **suspension**
- Equipment maintenance saga, supplier changes, inventory shrinkage

Your agent can query all of it through the tools below. It **cannot** create, modify, or delete anything.

## 2. Connection details

| | |
|---|---|
| **Endpoint** | `$BISTRO_MCP_URL` *(live as of Nov 11; URL rotates — ask Bondan for the current one)* |
| **Auth header** | `Authorization: Bearer $BISTRO_MCP_TOKEN` |
| **Protocol** | Streamable HTTP (MCP) |
| **Database** | `resto` (fixed) |

> The service runs on Bondan's machine via a Cloudflare tunnel. If the URL is dead, ask him to run `./start-tunnels.sh` and share the fresh URL.

## 3. Connect your client

### Claude Code
```bash
claude mcp add --transport http bistro \
  --header "Authorization: Bearer $BISTRO_MCP_TOKEN" \
  https://<current-tunnel-url>/mcp
```

### Cursor
Add to `.cursor/mcp.json` (project) or global MCP settings:
```json
{
  "mcpServers": {
    "bistro": {
      "url": "https://<current-tunnel-url>/mcp",
      "headers": { "Authorization": "Bearer $BISTRO_MCP_TOKEN" }
    }
  }
}
```

### Any other MCP client
- Transport: **Streamable HTTP**
- URL: `https://<current-tunnel-url>/mcp`
- Header: `Authorization: Bearer $BISTRO_MCP_TOKEN`

### Quick health check
```bash
curl https://<current-tunnel-url>/health
# → {"status":"ok","service":"bistro-mcp","db":"resto"}
```

## 4. Available tools

| Tool | What it returns |
|---|---|
| `get_pnl(month_from?, month_to?)` | P&L: totals, **monthly arc**, per-account breakdown. Months = `"YYYY-MM"` |
| `dish_rankings(month_from?, month_to?, limit?)` | Dishes ranked by revenue with qty sold |
| `get_orders(date_from?, date_to?, limit?)` | POS orders (ref, date, total, tax, state) |
| `get_sessions(limit?)` | Weekly POS sessions with order counts |
| `get_cash_differences(month_from?, month_to?)` | Cash Difference Loss/Gain entries — **drawer shortages** |
| `get_stock_levels(only_positive?)` | On-hand ingredient stock |
| `get_bills(unpaid_only?, month_from?, month_to?)` | Vendor bills & payment state |
| `get_employees()` | Staff directory (name, job, department) |
| `get_maintenance(open_only?)` | Equipment repair requests |
| `search_records(model, domain, fields, limit, order)` | Generic read-only search — see allowlist below |

**`search_records` allowlist:** `account.move`, `account.move.line`, `account.payment`, `pos.order`, `pos.order.line`, `pos.session`, `pos.payment`, `product.template`, `product.product`, `stock.quant`, `stock.move`, `stock.picking`, `stock.warehouse.orderpoint`, `purchase.order`, `purchase.order.line`, `hr.employee.public`, `hr.department`, `hr.attendance`, `maintenance.request`, `maintenance.equipment`, `res.partner`, `mrp.bom`, `mrp.bom.line`, `account.bank.statement`, `account.bank.statement.line`

Domain syntax example:
```json
{ "model": "pos.order",
  "domain": [["amount_total", ">", 80], ["state", "=", "done"]],
  "fields": ["name", "date_order", "amount_total"], "limit": 10 }
```

## 5. Try asking your agent

- *"Show me the restaurant's monthly P&L arc — is the business trending the right way?"*
- *"Rank the dishes by revenue for October and compare with September. What changed?"*
- *"Something is off with the cash. Can you find evidence of theft?"* 🔍
- *"Which menu item should be retired, and what replaced it?"*
- *"What are the outstanding unpaid bills? What's still broken in the restaurant?"*
- *"Pull the attendance records for Nina Patel in October and look for anything unusual."*

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `401 unauthorized` | Wrong/missing API key — check the `Authorization` header |
| Timeout / DNS error | Tunnel is down — ask Bondan to run `./start-tunnels.sh` (URL changes!) |
| `model not allowed` in `search_records` | Model isn't in the allowlist (see section 4) |
| Tool returns `Error calling tool` | Likely an Odoo-side query issue — check your domain syntax |

## 7. House rules

- **Read-only.** There is intentionally no write access — this is a shared simulation.
- Don't share the API key publicly; it's for our team.
- The story data runs **Jul 15 – Nov 11, 2026**. "Today" in the sim is Nov 11.
