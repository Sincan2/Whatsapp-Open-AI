const fs = require('fs');
const readline = require('readline');
const venoma = require('venom-bot');
const axios = require('axios');
const base64 = require('base64-js');
require('dotenv').config();

// Konfigurasi Venom
venoma
  .create({
    session: 'session-name' // nama sesi
  })
  .then((client) => start(client))
  .catch((error) => {
    console.log(error);
  });

// Fungsi untuk membaca dan menganalisis file log
function analyzeLogFile(logFilePath, keyword) {
  const readStream = fs.createReadStream(logFilePath);
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let keywordCount = 0;

  rl.on('line', (line) => {
    lineCount++;
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      console.log(`Found ${keyword} in line ${lineCount}: ${line}`);
      keywordCount++;
    }
  });

  rl.on('close', () => {
    console.log(`Total lines: ${lineCount}`);
    console.log(`Total occurrences of '${keyword}': ${keywordCount}`);
  });
}

// Fungsi untuk memulai sesi Venom
async function start(client) {
  client.onMessage(async (message) => {
    if (!message.isGroupMsg) {
      if (message.body.toLowerCase().includes('/log')) {
        // Analisis log jika perintah '/log' diterima
        const logFilePath = '/var/log/syslog'; // Path ke file log yang ingin dianalisis
        const keyword = 'error'; // Kata kunci yang ingin dicari dalam log
        analyzeLogFile(logFilePath, keyword);

        await client.sendText(message.from, 'Analisis log sedang dilakukan. Silakan cek log di konsol.');
      } else {
        await client.sendText(message.from, 'Perintah tidak dikenali. Gunakan /log untuk menganalisis log.');
      }
    }
  });
}
