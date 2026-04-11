const https = require('https');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { text, voice_id } = req.body;

    if (!text || !voice_id) {
      res.status(400).send('Missing text or voice_id');
      return;
    }

    const apiKey = 'sk_a0fbcde283feaf27f84f8a3c0c6f832775516d76fc33fc54';

    const postData = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.80,
        style: 0.25,
        use_speaker_boost: true
      }
    });

    const audioBuffer = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.elevenlabs.io',
        path: '/v1/text-to-speech/' + voice_id,
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const request = https.request(options, (response) => {
        if (response.statusCode !== 200) {
          let errBody = '';
          response.on('data', chunk => errBody += chunk);
          response.on('end', () => reject(new Error('ElevenLabs ' + response.statusCode + ': ' + errBody)));
          return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      });

      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(audioBuffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
