const amqp = require('amqplib');
const pool = require('../config/db');
const elastic = require('../config/elastic');

const QUEUE = 'news_queue';

async function createIndex(client) {
    const exists = await client.indices.exists({ index: 'news' });

    if (!exists) {
        await client.indices.create({
            index: 'news',
            mappings: {
                properties: {
                    title: { type: 'text' },
                    content: { type: 'text' },
                    author: { type: 'keyword' },
                    source: { type: 'keyword' },
                    created_at: { type: 'date' }
                }
            }
        });

        console.log('Elasticsearch index created');
    }
}

async function startWorker(retries = 5) {
    try {
        await createIndex(elastic);
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE, { durable: true });

        console.log('Worker connected to RabbitMQ. Waiting for messages...');

        channel.consume(
            QUEUE,
            async (msg) => {
                if (!msg) return;

                try {
                    const { id } = JSON.parse(msg.content.toString());
                    console.log('Processing news ID:', id);

                    const result = await pool.query(
                        'SELECT * FROM news WHERE id = $1',
                        [id]
                    );

                    const news = result.rows[0];

                    if (!news) {
                        console.warn('News not found:', id);
                        channel.ack(msg);
                        return;
                    }

                    await elastic.index({
                        index: 'news',
                        id: news.id,
                        refresh: true,
                        document: {
                            title: news.title,
                            content: news.content,
                            author: news.author,
                            source: news.source,
                            created_at: news.created_at
                        }
                    });

                    console.log('Indexed news ID:', news.id);

                    channel.ack(msg);
                } catch (err) {
                    console.error('Worker processing error:', err);
                    channel.nack(msg, false, true);
                }
            },
            { noAck: false }
        );

    } catch (err) {
        console.error('RabbitMQ not ready, retrying...', err.message);

        if (retries > 0) {
            setTimeout(() => startWorker(retries - 1), 5000);
        } else {
            console.error('Worker failed to connect to RabbitMQ');
        }
    }
}

startWorker();