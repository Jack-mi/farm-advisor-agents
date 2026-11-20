'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runAdvisor } = require('../src/advisor');
const { schedule } = require('../src/schedule');
const { deepSeek } = require('../src/deepseek');
const { read } = require('../examples/demo');

const call = (name, args = {}, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const run = (complete, reader = read) => runAdvisor({ question: '核对开支、农活和雨情。', complete, read: reader });
const reads = { ask_bookkeeper: 'query_summary', ask_logger: 'query_logs', ask_agronomist: 'weather_forecast' };

test('delegates across three domains and passes source evidence to synthesis', async () => {
  const result = await run(async ({ messages, tools }) => {
    const name = tools[0].function.name;
    const observations = messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content));
    if (name.startsWith('ask_')) {
      if (!observations.length) return { tool_calls: Object.keys(reads).map(role => call(role, { request: '核对该领域' })) };
      assert.deepEqual(observations.map(item => item.evidence[0].tool), Object.values(reads));
      assert.deepEqual(observations.map(item => item.evidence[0].recordIds[0]), ['ledger-demo-1', 'log-demo-1', 'forecast-demo-1']);
      assert.equal(messages[2].reasoning_content, undefined);
      return { content: '示例回答' };
    }
    if (!observations.length) {
      const target = Object.values(reads).find(readName => tools.some(item => item.function.name === readName));
      return { tool_calls: [call(target)], reasoning_content: 'not-public' };
    }
    assert.equal(messages[2].reasoning_content, 'not-public');
    return { content: '已查询 ' + observations[0].records[0].id };
  });
  assert.equal(result.ok, true);
  assert.equal(result.modelCalls, 8);
  assert.equal(result.trace.length, 3);
  assert.ok(result.trace.every(item => /^[a-f0-9]{64}$/.test(item.skillHash)));
  assert.equal(result.evidence.length, 3);
  assert.doesNotMatch(JSON.stringify(result), /not-public/);
});

test('runs no more than two specialist packets in parallel and preserves result order', async () => {
  const ids = ['first', 'second', 'third'];
  const started = [];
  const gates = Object.fromEntries(ids.map(id => [id, Promise.withResolvers()]));
  const thirdStarted = Promise.withResolvers();
  const result = schedule(ids.map(id => ({ id })), async ({ id }) => {
    started.push(id);
    if (id === 'third') thirdStarted.resolve();
    await gates[id].promise;
    return id;
  });
  assert.deepEqual(started, ['first', 'second']);
  gates.second.resolve();
  await thirdStarted.promise;
  gates.third.resolve();
  gates.first.resolve();
  assert.deepEqual(await result, ids);
});

test('blocks a write, cross-role read, or malformed arguments before any read', async () => {
  for (const invalidCall of [call('draft_cost'), call('query_tasks'), call('query_summary', { otherFarm: true })]) {
    let readCount = 0;
    const result = await run(async ({ tools }) => ({
      tool_calls: tools[0].function.name === 'ask_bookkeeper'
        ? [call('ask_bookkeeper', { request: '核对开支' })]
        : [call('query_summary', {}, 'valid'), invalidCall]
    }), () => { readCount++; });
    assert.equal(result.ok, false);
    assert.equal(readCount, 0);
  }
});

test('rejects evidence-free replies and never returns a partial answer on reader failure', async () => {
  assert.equal((await run(async () => ({ content: '猜测' }))).error, 'missing_evidence');
  const result = await run(async ({ tools }) => ({
    tool_calls: tools[0].function.name === 'ask_bookkeeper'
      ? [call('ask_bookkeeper', { request: '核对开支' })]
      : [call('query_summary')]
  }), () => { throw new Error('reader-secret'); });
  assert.equal(result.ok, false);
  assert.equal(result.answer, undefined);
  assert.doesNotMatch(JSON.stringify(result), /reader-secret/);
});

test('uses a single ten-call budget across the coordinator and experts', async () => {
  let calls = 0;
  const result = await run(async ({ tools, messages }) => {
    calls++;
    const name = tools[0].function.name;
    const previous = messages.filter(message => message.role === 'tool').length;
    if (name.startsWith('ask_')) return {
      tool_calls: Object.keys(reads).map(role => call(role, { request: '核对该领域' }))
    };
    if (previous < tools.length) return { tool_calls: [call(tools[previous].function.name)] };
    return { content: '已查询' };
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 10);
  assert.equal(result.modelCalls, 10);
});

test('DeepSeek adapter sends model, chat messages and tool schemas to a fixed endpoint', async () => {
  const signal = new AbortController().signal;
  const complete = deepSeek({
    apiKey: 'unit-test-value',
    model: 'test-model',
    request: async (url, options) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.signal, signal);
      assert.equal(options.redirect, 'error');
      assert.deepEqual(JSON.parse(options.body), { model: 'test-model', messages: [], tools: [], tool_choice: 'auto' });
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    }
  });
  assert.deepEqual(await complete({ messages: [], tools: [], signal }), { content: 'ok' });
});
