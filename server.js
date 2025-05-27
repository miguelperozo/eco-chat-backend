require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

let threadId = null;

app.post('/api/message', async (req, res) => {
  const userMessage = req.body.message;

  try {
    if (!threadId) {
      const threadRes = await axios.post('https://api.openai.com/v1/threads', {}, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
          'Content-Type': 'application/json'
        }
      });
      threadId = threadRes.data.id;
    }

    await axios.post(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      role: "user",
      content: userMessage
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        'Content-Type': 'application/json'
      }
    });

    const runRes = await axios.post(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      assistant_id: ASSISTANT_ID
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        'Content-Type': 'application/json'
      }
    });

    let status = 'queued';
    let retries = 0;
    while (status !== 'completed' && retries < 20) {
      await new Promise(res => setTimeout(res, 1500));
      const statusRes = await axios.get(`https://api.openai.com/v1/threads/${threadId}/runs/${runRes.data.id}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      status = statusRes.data.status;
      retries++;
    }

    const messageRes = await axios.get(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    const reply = messageRes.data.data.find(m => m.role === "assistant")?.content?.[0]?.text?.value || "Sin respuesta.";
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al conectar con OpenAI." });
  }
});

app.listen(3000, () => console.log("Servidor escuchando en http://localhost:3000"));
