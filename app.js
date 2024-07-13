const fs = require('fs');
const venom = require('venom-bot');
const axios = require('axios');
const base64 = require('base64-js');
require('dotenv').config(); // Cargar variables de entorno desde el archivo .env

venom
  .create({
    session: 'session-name' // nombre de la sesión
  })
  .then((client) => start(client))
  .catch((error) => {
    console.log(error);
  });

// Función para cargar el chat del usuario desde un archivo JSON
function loadChat(message) {
  const filePath = `chats/${message.from}.json`;
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

// Función para enviar archivos de audio a través de WhatsApp
async function sendAudio(client, message, audioData) {
  const filePath = `temp/${Math.random().toString(36).substring(7)}.mp3`;
  fs.writeFileSync(filePath, audioData, 'base64');
  await client.sendVoice(message.from, filePath);
  fs.unlinkSync(filePath); // Eliminamos el archivo después de enviarlo
}

async function start(client) {
  client.onMessage(async (message) => {
    if (!message.isGroupMsg) {
      if (message.body.toLowerCase() === '/clear') {
        const filePath = `chats/${message.from}.json`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Eliminamos el archivo del historial
          await client.sendText(message.from, '¡Historial eliminado con éxito!');
        } else {
          await client.sendText(message.from, 'No hay historial que eliminar.');
        }
        return;
      }

      // Cargamos el chat del usuario desde el archivo JSON
      let conversationMessages = loadChat(message);

      conversationMessages.push({ role: 'user', content: message.body });

      // Limitamos el número de mensajes almacenados a 10
      if (conversationMessages.length > 10) {
        conversationMessages.shift(); // Eliminamos el mensaje más antiguo
      }

      // Guardamos el chat del usuario en un archivo JSON
      const filePath = `chats/${message.from}.json`;
      fs.writeFileSync(filePath, JSON.stringify(conversationMessages));

      try {
        // Obtenemos la respuesta del asistente desde la API
        const response = await axios.post(process.env.OPENAI_SERVER, {
          model: process.env.MODEL,
          messages: conversationMessages
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TOKEN}`
          }
        });

        // Extraemos el contenido de la respuesta del asistente
        const assistantResponse = response.data.choices[0].message.content;

        // Guardamos la respuesta del asistente en el chat del usuario
        conversationMessages.push({ role: 'assistant', content: assistantResponse });
        fs.writeFileSync(filePath, JSON.stringify(conversationMessages));

        // Enviamos la respuesta del asistente al usuario
        await client.sendText(message.from, assistantResponse);

        // Convertimos el texto a voz y lo enviamos como archivo de audio
        const audioResponse = await axios.post(process.env.PIPER_API_URL, {
          text: assistantResponse,
          model: process.env.PIPER_MODEL
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PIPER_API_TOKEN}` // Aquí se agrega el token desde el archivo .env
          }
        });

        const audioBase64 = audioResponse.data.audio_base64;
        const audioBuffer = Buffer.from(audioBase64, 'base64');

        await sendAudio(client, message, audioBuffer);
      } catch (error) {
        console.error('Error al realizar la solicitud:', error);
        await client.sendText(message.from, '¡Lo siento! Hubo un error al procesar su solicitud.');
      }
    }
  });
}
