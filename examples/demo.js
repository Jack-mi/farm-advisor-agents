'use strict';

const { runAdvisor } = require('../src/advisor');
const { deepSeek } = require('../src/deepseek');

const records = {
  query_summary: [{ id: 'ledger-demo-1', seasonId: 'season-demo-1', expenseCny: 680, incomeCny: 0, netCny: -680 }],
  query_logs: [{ id: 'log-demo-1', plotId: 'plot-demo-1', date: '2026-10-18', operation: '巡田' }],
  query_tasks: [{ id: 'task-demo-1', plotId: 'plot-demo-1', date: '2026-10-20', title: '检查土壤墒情', status: 'open' }],
  query_plots: [{ id: 'plot-demo-1', name: '示例北田', areaMu: 10 }],
  query_seasons: [{ id: 'season-demo-1', plotId: 'plot-demo-1', crop: '冬小麦', stage: '出苗期', observedOn: '2026-10-18' }],
  weather_forecast: [{ id: 'forecast-demo-1', plotId: 'plot-demo-1', issuedOn: '2026-10-18', date: '2026-10-20', precipitationMm: 12 }]
};

function read(name) {
  return { source: 'synthetic-demo-2026-10-18', records: records[name] };
}

async function main() {
  const question = process.argv.slice(2).join(' ') || '以示例的 10 月 18 日为准，结合这季花费、已完成的农活和雨情，给北田排一下接下来两天的优先事项。';
  const complete = deepSeek({ apiKey: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL });
  const result = await runAdvisor({ question, complete, read });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { read };
