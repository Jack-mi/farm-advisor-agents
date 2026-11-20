'use strict';

function deepSeek({ apiKey, model, request = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || typeof model !== 'string' || !model.trim()) {
    throw new TypeError('set DEEPSEEK_API_KEY and DEEPSEEK_MODEL');
  }
  return async ({ messages, tools, signal }) => {
    const response = await request('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
      signal,
      redirect: 'error'
    });
    if (!response.ok) throw new Error('upstream_failed');
    return (await response.json()).choices?.[0]?.message;
  };
}

module.exports = { deepSeek };
