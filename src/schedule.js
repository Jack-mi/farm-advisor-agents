'use strict';

async function schedule(packets, execute) {
  if (!Array.isArray(packets) || packets.length > 3 || new Set(packets.map(packet => packet.id)).size !== packets.length) throw new Error('invalid_work_packets');
  const results = new Array(packets.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= packets.length) return;
      try { results[index] = await execute(packets[index]); }
      catch { results[index] = { error: 'packet_failed' }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, packets.length) }, worker));
  return results;
}

module.exports = { schedule };
