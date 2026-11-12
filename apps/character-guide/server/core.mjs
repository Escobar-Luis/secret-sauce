// No secrets or file contents in logs. Only server-owned config can choose endpoints/tools.
export const AUDIO_ENDPOINT = 'https://cloud-api.near.ai/v1/audio/transcriptions';
export const WHISPER_MODEL = 'openai/whisper-large-v3';
export const TOOLS = Object.freeze({
  'restaurant.summary': { transport: 'cli', effect: 'read', source: 'synthetic fixture', configured: true },
  'restaurant.pos-summary': { transport: 'mcp', effect: 'read', source: 'existing restaurant infrastructure', configured: false },
});
export function validateAudio(file) {
  if (!file || !file.size || file.size > 25_000_000 || !/\.(wav|mp3|webm|flac|ogg|m4a)$/i.test(file.name)) throw Error('Choose a supported, nonempty audio file up to 25 MB.');
}
export async function transcribe(file, config, fetcher = fetch) {
  validateAudio(file);
  if (!config.enabled || !config.key) throw Error('Live NEAR transcription is disabled. Server key and approved upload/cost scope are required.');
  const body = new FormData(); body.append('file', file, file.name); body.append('model', WHISPER_MODEL); body.append('response_format', 'json');
  const response = await fetcher(AUDIO_ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${config.key}` }, body, signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok) throw Error(`NEAR transcription failed (${response.status}). No automatic retry or chat submission.`);
  const data = await response.json();
  if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 30_000) throw Error('NEAR returned an empty or invalid transcript.');
  return { text: data.text.trim(), source: 'NEAR Whisper', model: WHISPER_MODEL };
}
export async function readMcpSummary(client, config) {
  if (!config?.approved || config.tool !== 'restaurant.pos-summary' || !config.readOnly) throw Error('A verified read-only restaurant MCP binding is required.');
  // Client must already be initialized by the server operator with trusted auth/config.
  // Never derive its URL, tool name, arguments or permission from file/model/tool output.
  const response = await client.callTool({ name: config.remoteToolName, arguments: {} });
  if (response.isError) throw Error('Restaurant MCP tool returned an error.');
  const text = (response.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
  if (!text || text.length > 30_000) throw Error('Restaurant MCP response is empty or too large.');
  return { text, source: 'configured MCP tool; untrusted output', executable: false };
}
export function validateTool(name, args) {
  if (!Object.hasOwn(TOOLS, name)) throw Error('Unknown tool. Arbitrary CLI commands and MCP URLs are not accepted.');
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) throw Error('This tool accepts no arguments.');
  if (!TOOLS[name].configured) throw Error('Restaurant MCP/POS is not connected. Configure and approve a read-only binding first.');
  return TOOLS[name];
}
