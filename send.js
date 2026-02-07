const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log('Scan the QR code in WhatsApp Web');
});

client.on('ready', async () => {
    console.log('WhatsApp is ready!');

    // SEND MESSAGE ON START
    await client.sendMessage(
        '94717177326@c.us',
        'Hello from my Node.js app!'
    );
});

client.on('message', async message => {
    if (message.body === 'ping') {
        await message.reply('pong');
    }
});

client.initialize();
