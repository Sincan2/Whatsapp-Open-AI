require('dotenv').config(); // Para cargar las variables de entorno desde el archivo .env
const venom = require('venom-bot');
const axios = require('axios');

// Objeto en memoria para almacenar las conversaciones de los usuarios
const userChats = {};

// Función para iniciar el bot y manejar los mensajes
async function start(client) {
  client.onMessage(async (message) => {
    if (!message.isGroupMsg) {
      const userId = message.from;

      // Comprobamos si el mensaje es para limpiar el historial
      if (message.body.toLowerCase() === '/clear') {
        if (userChats[userId]) {
          delete userChats[userId]; // Eliminamos el historial del usuario
          await client.sendText(userId, '¡Historial eliminado con éxito!');
        } else {
          await client.sendText(userId, 'No hay historial que eliminar.');
        }
        return;
      }

      // Cargamos la conversación del usuario desde el objeto en memoria
      let conversationMessages = userChats[userId] || [];

      // Agregamos el nuevo mensaje del usuario al arreglo
      conversationMessages.push({ role: 'user', content: message.body });

      // Limitamos el número de mensajes almacenados a 10
      if (conversationMessages.length > 10) {
        conversationMessages.shift(); // Eliminamos el mensaje más antiguo
      }

      // Guardamos la conversación actualizada en la RAM
      userChats[userId] = conversationMessages;

      // Ejecutamos la solicitud a la API utilizando axios
      try {
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

        // Agregamos la respuesta del asistente al arreglo
        conversationMessages.push({ role: 'assistant', content: assistantResponse });

        // Limitamos el número de mensajes almacenados a 10
        if (conversationMessages.length > 10) {
          conversationMessages.shift(); // Eliminamos el mensaje más antiguo
        }

        // Guardamos la conversación actualizada en la RAM
        userChats[userId] = conversationMessages;

        // Enviamos la respuesta del asistente al usuario
        await client.sendText(userId, assistantResponse);
      } catch (error) {
        console.error('Error al realizar la solicitud a la API:', error);
      }
    }
  });
}

venom
  .create({
    session: 'session-name' // nombre de la sesión
  })
  .then((client) => start(client))
  .catch((error) => {
    console.log(error);
  });
