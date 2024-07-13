const fs = require('fs');
const venom = require('venom-bot');
const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config(); // Memuat variabel lingkungan dari file .env

const userStates = {}; // Objek untuk menyimpan status bot untuk setiap pengguna

async function callVertexAI(promptText) {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  const location = process.env.GOOGLE_PROJECT_LOCATION;
  const model = 'gemini-1.5-pro-001';

  // Initialize Vertex with your Cloud project and location
  const vertexAI = new VertexAI({ project: projectId, location: location });

  // Instantiate the model
  const generativeVisionModel = vertexAI.getGenerativeModel({
    model: model,
  });

  const textPart = {
    text: promptText,
  };

  const request = {
    contents: [{ role: 'user', parts: [textPart] }],
  };

  console.log('Prompt Text:');
  console.log(request.contents[0].parts[0].text);

  console.log('Non-Streaming Response Text:');
  // Create the response stream
  const responseStream = await generativeVisionModel.generateContentStream(request);

  // Wait for the response stream to complete
  const aggregatedResponse = await responseStream.response;

  // Select the text from the response
  const fullTextResponse = aggregatedResponse.candidates[0].content.parts[0].text;

  return fullTextResponse;
}

venom
  .create({
    session: 'session_venom', // nama sesi
  })
  .then((client) => start(client))
  .catch((error) => {
    console.log(error);
  });

function loadChat(userId) {
  const filePath = `chats/${userId}.json`;
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

function cleanAssistantResponse(response) {
  const regex = /^\$@\$.+?\$@\$/;
  return response.replace(regex, '').trim();
}

function saveUserNumber(number) {
  const filePath = `users/${number}.json`;
  const userData = { number };
  fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
}

async function start(client) {
  client.onMessage(async (message) => {
    if (message.isGroupMsg) return;

    const userId = message.sender.id;

    saveUserNumber(userId);

    if (!message.body || typeof message.body !== 'string') {
      console.warn(`Pesan tanpa tubuh diterima dari ${userId}`);
      return;
    }

    const messageBodyLower = message.body.toLowerCase();
    if (messageBodyLower === 'hadi') {
      userStates[userId] = true;
      await client.sendText(
        message.from,
        'Bot diaktifkan! Kirim pesan ke Hadi.\n\nPerintah Hadi:\nbye: Mengakhiri percakapan.\n/hapus: Menghapus chat dengan Hadi'
      );
      return;
    } else if (messageBodyLower === 'bye') {
      userStates[userId] = false;
      await client.sendText(message.from, 'Bot dinonaktifkan!');
      return;
    } else if (messageBodyLower === '/hapus') {
      const filePath = `chats/${userId}.json`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        await client.sendText(message.from, 'Riwayat berhasil dihapus!');
      } else {
        await client.sendText(message.from, 'Tidak ada riwayat yang dapat dihapus.');
      }
      return;
    }

    if (!userStates[userId]) return;

    let conversationMessages = loadChat(userId);

    conversationMessages.push({ role: 'user', content: message.body });

    if (conversationMessages.length > 30) {
      conversationMessages.shift();
    }

    const filePath = `chats/${userId}.json`;
    fs.writeFileSync(filePath, JSON.stringify(conversationMessages));

    try {
      const systemMessage = {
        role: 'system',
        content: `Kamu adalah asisten yang ramah dan langsung dalam memberikan jawaban.`,
      };

      const apiMessages = [systemMessage, ...conversationMessages.map((msg) => ({ role: msg.role, content: msg.content }))];

      const assistantResponse = await callVertexAI(apiMessages.map(msg => msg.content).join('\n'));
      const cleanedResponse = cleanAssistantResponse(assistantResponse);

      conversationMessages.push({ role: 'assistant', content: cleanedResponse });
      fs.writeFileSync(filePath, JSON.stringify(conversationMessages));

      await client.reply(message.from, cleanedResponse, message.id);
    } catch (error) {
      console.error('Error saat melakukan permintaan:', error.response ? error.response.data : error.message);
      await client.sendText(message.from, 'Maaf! Terjadi kesalahan saat memproses permintaan Anda.');
    }
  });
}
