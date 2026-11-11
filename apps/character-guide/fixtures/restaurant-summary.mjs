// Static synthetic read-only command, no file/network/environment access.
process.stdout.write(JSON.stringify({ source: 'synthetic CLI fixture, not live POS', sales: 2480, currency: 'USD', inventory: { tomatoesDays: 2 }, writesPerformed: 0 }));
