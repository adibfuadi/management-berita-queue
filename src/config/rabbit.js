const amqp = require('amqplib');

let connection;
let channel;
let connecting = false;

async function connectRabbit(retries = 5) {
    if (channel || connecting) return channel;

    connecting = true;

    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL);

        connection.on('error', (err) => {
            console.error('RabbitMQ connection error', err.message);
            channel = null;
        });

        connection.on('close', () => {
            console.error('RabbitMQ connection closed. Reconnecting...');
            channel = null;
            connecting = false;
            connectRabbit();
        });

        channel = await connection.createChannel();
        await channel.assertQueue('news_queue', { durable: true });

        console.log('RabbitMQ connected');
        connecting = false;
        return channel;

    } catch (err) {
        console.error('RabbitMQ connect failed:', err.message);
        connecting = false;

        if (retries > 0) {
            setTimeout(() => connectRabbit(retries - 1), 5000);
        }
    }
}

function getChannel() {
    return channel;
}

module.exports = {
    connectRabbit,
    getChannel,
};