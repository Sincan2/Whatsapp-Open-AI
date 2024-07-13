const fs = require('fs');
const venom = require('venom-bot');
const axios = require('axios');
require('dotenv').config(); // Cargar variables de entorno desde el archivo .env

const userStates = {}; // Objeto para almacenar el estado del bot para cada usuario

venom
  .create({
    session: 'sesion_venom' // nombre de la sesión
  })
  .then((client) => start(client))
  .catch((error) => {
    console.log(error);
  });

// Función para cargar el chat del usuario desde un archivo JSON
function loadChat(userId) {
  const filePath = `chats/${userId}.json`;
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return [];
}

// Función para eliminar el ID del formato de respuesta
function cleanAssistantResponse(response) {
  const regex = /^\$@\$.+?\$@\$/;
  return response.replace(regex, '').trim();
}

// Función para guardar el número de un usuario en un archivo JSON
function saveUserNumber(number) {
  const filePath = `users/${number}.json`;
  const userData = { number };
  fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
}

async function start(client) {
  client.onMessage(async (message) => {
    if (message.isGroupMsg) return; // Verificamos si el mensaje es de un grupo

    const userId = message.sender.id; // Usamos el ID del remitente para identificar al usuario

    // Guardamos el número del usuario
    saveUserNumber(userId);

    // Validamos que el mensaje tenga un cuerpo antes de continuar
    if (!message.body || typeof message.body !== 'string') {
      console.warn(`Mensaje sin cuerpo recibido de ${userId}`);
      return;
    }

    // Comandos para activar o desactivar el bot
    const messageBodyLower = message.body.toLowerCase();
    if (messageBodyLower === '/iniciar') {
      userStates[userId] = true;
      await client.sendText(message.from, '¡Bot activado! Escribe un mensaje a VenomBot.\n\nComandos de VenomBot:\n/bye: Terminar conversación.\n/limpiar: Eliminar chats con VenomBot');
      return;
    } else if (messageBodyLower === '/bye') {
      userStates[userId] = false;
      await client.sendText(message.from, '¡Bot desactivado!');
      return;
    } else if (messageBodyLower === '/limpiar') {
      const filePath = `chats/${userId}.json`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Eliminamos el archivo del historial
        await client.sendText(message.from, '¡Historial eliminado con éxito!');
      } else {
        await client.sendText(message.from, 'No hay historial que eliminar.');
      }
      return;
    }

    // Si el bot está desactivado para el usuario, no responde a otros mensajes
    if (!userStates[userId]) return;

    // Cargamos el chat del usuario desde el archivo JSON
    let conversationMessages = loadChat(userId);

    conversationMessages.push({ role: 'user', content: message.body });

    // Limitamos el número de mensajes almacenados a 30
    if (conversationMessages.length > 30) {
      conversationMessages.shift(); // Eliminamos el mensaje más antiguo
    }

    // Guardamos el chat del usuario en un archivo JSON
    const filePath = `chats/${userId}.json`;
    fs.writeFileSync(filePath, JSON.stringify(conversationMessages));

    try {
      // Definimos el mensaje de sistema
      const systemMessage = {
        role: 'system',
        content: `Eres un asistente amable y directo en sus respuestas.`
      };

      // Agregamos el mensaje de sistema antes de hacer la solicitud a la API
      const apiMessages = [systemMessage, ...conversationMessages];

      // Obtenemos la respuesta del asistente desde la API
      const response = await axios.post(process.env.OPENAI_SERVER, {
        model: process.env.MODEL,
        messages: apiMessages
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TOKEN}`
        }
      });

      // Extraemos el contenido de la respuesta del asistente
      const assistantResponse = response.data.choices[0].message.content;
      const cleanedResponse = cleanAssistantResponse(assistantResponse);

      // Guardamos la respuesta del asistente en el chat del usuario
      conversationMessages.push({ role: 'assistant', content: cleanedResponse });
      fs.writeFileSync(filePath, JSON.stringify(conversationMessages));

      // Enviamos la respuesta del asistente al usuario, citando el mensaje del usuario
      await client.reply(message.from, cleanedResponse, message.id);
    } catch (error) {
      console.error('Error al realizar la solicitud:', error);
      await client.sendText(message.from, '¡Lo siento! Hubo un error al procesar su solicitud.');
    }
  });
}
