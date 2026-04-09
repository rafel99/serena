const https = require(‘https’);

exports.handler = async function(event) {
if (event.httpMethod === ‘OPTIONS’) {
return {
statusCode: 200,
headers: {
‘Access-Control-Allow-Origin’: ‘*’,
‘Access-Control-Allow-Headers’: ‘Content-Type’,
‘Access-Control-Allow-Methods’: ‘POST, OPTIONS’,
},
body: ‘’
};
}

if (event.httpMethod !== ‘POST’) {
return { statusCode: 405, body: ‘Method Not Allowed’ };
}

try {
const body = JSON.parse(event.body);
const text = body.text;
const voiceId = body.voice_id;

```
if (!text || !voiceId) {
return { statusCode: 400, body: 'Missing text or voice_id' };
}

const apiKey = [
'sk_a0fbcde283feaf27f84f8a3c0c6f832775516d76fc33fc54'
].join('');

const postData = JSON.stringify({
text: text,
model_id: 'eleven_multilingual_v2',
voice_settings: {
stability: 0.55,
similarity_boost: 0.80,
style: 0.25,
use_speaker_boost: true
}
});

const audioBuffer = await new Promise(function(resolve, reject) {
const options = {
hostname: 'api.elevenlabs.io',
path: '/v1/text-to-speech/' + voiceId,
method: 'POST',
headers: {
'xi-api-key': apiKey,
'Content-Type': 'application/json',
'Content-Length': Buffer.byteLength(postData)
}
};

const req = https.request(options, function(res) {
if (res.statusCode !== 200) {
let errBody = '';
res.on('data', function(chunk) { errBody += chunk; });
res.on('end', function() {
reject(new Error('ElevenLabs ' + res.statusCode + ': ' + errBody));
});
return;
}
const chunks = [];
res.on('data', function(chunk) { chunks.push(chunk); });
res.on('end', function() { resolve(Buffer.concat(chunks)); });
});

req.on('error', reject);
req.write(postData);
req.end();
});

return {
statusCode: 200,
headers: {
'Access-Control-Allow-Origin': '*',
'Content-Type': 'audio/mpeg'
},
body: audioBuffer.toString('base64'),
isBase64Encoded: true
};
```

} catch (err) {
return {
statusCode: 500,
headers: { ‘Access-Control-Allow-Origin’: ‘*’ },
body: JSON.stringify({ error: err.message })
};
}
};