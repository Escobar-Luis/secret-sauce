# Secret Sauce: restaurant decisions, an animated guide, and optional NEAR Intents

2026-11-11 | Explanation and proposed demo, not an implemented integration

## The idea

A restaurant owner asks a practical question, Secret Sauce explains the relevant business numbers, and the animated character walks through the answer. The character should be a guide to evidence and choices, not a mascot that silently spends money.

This interprets "all of these" as the four restaurant demo areas, private AI, and the linked NEAR Intents concept. If a different set of features was intended, this plan needs adjusting.

Keep three parts separate:

1. **Restaurant data and analysis:** sales, inventory, staffing totals and supplier prices.
2. **The animated guide:** points to a number, explains it, and previews a possible next step.
3. **Optional payment execution:** NEAR Intents can exchange supported crypto assets across supported networks. It is not the restaurant's inventory, ordering, payroll or banking system.

## Four scenes the restaurant could use

These figures are synthetic examples from the current demo. They are not forecasts or real restaurant records. Each script is 35 words, targeting about 10 seconds at 3.5 words/second. Real voice speed varies, and character walking adds time.

### 1. Sales: understand the service

**Screen:** dinner sales $2,400; 80 covers; average check $30.

**Owner question:** "Was dinner quiet because fewer people came in, or because each table spent less?"

**Character action:** walk to sales, point to covers, then average check. Show the arithmetic and a proposed comparison with another service, rather than inventing a cause.

**Suggested script:** "Tonight's example shows eighty covers and twenty four hundred dollars in sales, or thirty dollars per guest. I can compare another service to separate traffic from average spend, without needing guest names or card details."

**Useful later integration:** read-only, owner-approved POS summaries with service dates, currency, refunds, discounts and comparable periods. An actual cause still needs evidence.

### 2. Inventory: prepare before service

**Screen:** 12 kg tomatoes on hand; 8 kg planned use; 4 kg projected remainder.

**Owner question:** "Do we have enough for tomorrow's menu?"

**Character action:** point to stock and recipe usage, animate the subtraction, then show a draft shopping-list entry if an approved threshold is crossed.

**Suggested script:** "We start with twelve kilograms of tomatoes. The planned menu uses eight, leaving four. I can flag a possible shortage against your chosen buffer and prepare a draft reorder, but you approve any supplier purchase."

**Useful later integration:** inventory counts, recipes, expected covers and delivery lead times. Check units, waste and count timestamps. The example alone does not establish a shortage, spoilage or food safety.

### 3. Staffing: explain coverage

**Screen:** 30 planned team hours; 90 expected covers; 3 covers per team hour.

**Owner question:** "Does the team have enough coverage for this service?"

**Character action:** compare aggregate workload and coverage. Show a suggestion for the manager to review, not an automatic staff cut or shift change.

**Suggested script:** "This example plans thirty team hours for ninety covers, or three covers per team hour. I can compare similar services and highlight coverage questions. A manager reviews recommendations; I do not change shifts or payroll."

**Useful later integration:** approved scheduling totals, reservations and historical service patterns. Use role-based access and aggregates where possible. Covers per hour alone does not measure an employee's performance or establish safe staffing.

### 4. Supplier costs: compare, then optionally pay

**Screen:** olive oil $8/L before, $9/L now, a 12.5% increase.

**Owner question:** "What changed in this invoice, and should I review another supplier?"

**Character action:** highlight unit price and product match, show a proposed comparison, then stop at approval. If both parties want a supported crypto payment, a separate payment panel could follow.

**Suggested script:** "Olive oil rises from eight to nine dollars per liter in this example, twelve point five percent. I can highlight the change, compare matching products, and draft a supplier question. No order changes without approval."

**Useful later integration:** approved invoice line items, quantities, pack sizes, delivery charges and supplier terms. Do not compare unlike units or mistake a smaller pack for a lower price.

## Where NEAR Intents fits

The linked documentation defines an intent as a desired asset outcome rather than a set of bridging and swap steps. Solvers compete to fulfill it, and smart contracts enforce the quoted execution conditions. The 1Click API provides quote requests, a quote-specific deposit address, execution tracking and refund handling. [1][2]

A plausible restaurant use case is **optional supplier settlement**: the restaurant already holds crypto on one supported network, and its verified supplier accepts a specific supported token on another network. After separately approving the invoice and payment terms, the owner could review a quote for delivering that asset to the supplier.

This is a proposal, not a recommendation to adopt crypto. If the supplier expects dollars by bank transfer, Intents alone does not provide that bank payment. A separate, vetted fiat on/off-ramp and accounting process would be needed. Intents does not establish supplier identity, invoice validity, tax treatment or whether the food was delivered. It also does not order ingredients or update stock by itself.

**Proposed character demonstration:**

- "You approved this supplier invoice. Here is a simulated token conversion and delivery quote."
- Show input asset/network, maximum total input, output asset/network, minimum delivered amount, verified recipient, refund destination, quote expiry and all fees.
- Label the entire panel **SIMULATION - NO WALLET CONNECTED - NO FUNDS MOVE**.
- Stop before a real transaction. A production version would require an explicit owner approval and wallet authorization, then show submitted, pending, completed, failed or refunded based on actual status. A moving character is never proof of settlement.

Keep this simulation within the supplier page or as an optional detail panel. Do not imply that all four business workflows need blockchain transactions.

## Privacy and money boundaries

**Private AI is different from payment privacy.** NEAR AI describes TEE-based inference and route-specific gateway/model evidence, connection binding, response signatures and image provenance. That is a possible later analysis backend, not evidence that Secret Sauce currently provides those protections. Verify the deployed request path before showing a "verified" badge. A response without an available signature is not response-verified. Data stored in the browser, application database, logs, analytics or backups needs its own protection. [5][6]

**Do not claim Intents is automatically anonymous.** The standard and confidential swap routes differ. The confidential-swap guide describes reduced linkage between deposits and withdrawals, but the service terms explicitly do not guarantee privacy against every party. The operator can retain and access transaction information for legal, compliance and security purposes. Eligibility and screening can apply. Never send restaurant records or invoice text to a solver network merely to request a payment quote. [4][7][8]

**Refunds do not mean zero cost or no risk.** The introductory page describes atomic execution and refunds. The terms say infrastructure fees can remain non-refundable even when a transaction fails or reverts. Current fees include several potential layers; exact costs, slippage, minimum delivered amount, deadlines and refund handling must be checked on the actual route. Do not promise the cheapest route, instant settlement or a free reversal. Asset, smart-contract, network and address risks remain. [1][3][4]

**Approval is a real boundary.** A suggestion to reorder, change a shift or pay a supplier is not permission to do it. Separate read access from write access, verify recipient and invoice details, set transaction limits, and retain an audit record without exposing secrets. Wallet keys, recovery phrases and API credentials never belong in scripts, screenshots, repositories or chat. An invoice or message that asks the assistant to change a wallet address is untrusted input, not authorization.

## What exists versus what is proposed

| Capability | Current evidence | Still needed |
| --- | --- | --- |
| Four restaurant pages | Draft PR #4, synthetic figures, direct hash navigation, captions, animated character | Independent review, applicable gates and accepted landing |
| About 10-second explanations | Four existing demo scripts; measured mean 10.84 seconds in Chrome, plus walking | Real narration timing if voice is added |
| Local device audio | Existing file chooser, temporary browser URL, no upload in that flow | Per-page narration and any approved voice-generation path |
| Restaurant analysis | No real dataset or POS/inventory/scheduling/invoice integration | Approved sources, data contracts, access controls, deterministic arithmetic and evidence-linked AI answers |
| Private AI inference | Not connected or attested in this demo | Backend integration, protected storage/logging, verified deployment/request path and tests |
| NEAR Intents payments | No wallet, quote or payment integration | Owner-approved scope, supported route, recipient verification, fees/refund checks, compliance and explicit transaction authorization |

## Recommended next step

Use the four existing pages to tell a single service-day story: understand sales, check stock, review coverage, then inspect a supplier price change. Keep any Intents payment panel simulated and optional. Establish one real read-only restaurant data source before adding automated business actions. The character should show **what data supports the answer, what remains uncertain, and what needs approval**.

This document adds an explanation only. It does not authorize data disclosure, deployments, wallet setup, swaps, payments, orders, staffing changes, paid inference or public release.

## Sources

Read November 11, 2026. These are current official product and primary technical/legal sources, not an independent security audit or proof of a working Secret Sauce integration. Where introductory claims are broader than the terms, the limits are preserved above.

1. [What are Intents?](https://docs.near-intents.org/getting-started/what-are-intents)
2. [1Click Swap API](https://docs.near-intents.org/integration/distribution-channels/1click-api/about-1click-api)
3. [Fees](https://docs.near-intents.org/resources/fees)
4. [1Click Terms of Service](https://docs.near-intents.org/security-compliance/terms-of-service), especially sections 6.4 and 7.1
5. [NEAR AI private inference](https://docs.near.ai/cloud/private-inference)
6. [Verify the NEAR AI Cloud Gateway](https://docs.near.ai/cloud/verification/cloud-api)
7. [Confidential swaps](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps)
8. [Risk and compliance](https://docs.near-intents.org/security-compliance/risk-and-compliance)
