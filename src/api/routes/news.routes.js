const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const elastic = require('../../config/elastic');
const { getChannel } = require('../../config/rabbit');

router.get('/', (req, res) => {
    res.send('Welcome to the News API Queue Service');
})

router.get('/news', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        const q = req.query.q;

        let whereClause = '';
        let values = [];

        if (q) {
            values.push(`%${q}%`);
            values.push(`%${q}%`);
            whereClause = `
          WHERE title ILIKE $${values.length - 1}
             OR content ILIKE $${values.length}
        `;
        }

        const dataQuery = `
        SELECT *
        FROM news
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `;

        const countQuery = `
        SELECT COUNT(*) 
        FROM news
        ${whereClause}
      `;

        const dataResult = await pool.query(
            dataQuery,
            [...values, limit, offset]
        );

        const countResult = await pool.query(countQuery, values);

        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: dataResult.rows,
            meta: {
                page,
                limit,
                total,
                totalPages,
            },
        });

    } catch (err) {
        console.error('Error fetching news:', err);
        res.status(500).json({ message: 'Error fetching news' });
    }
});


router.post('/news', async (req, res) => {
    const { title, content, author, source } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO news (title, content, author, source) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, content, author || 'Anonymous', source || 'Unknown']
        );

        const newsId = result.rows[0].id;

        const channel = getChannel();

        if (!channel) {
            return res.status(503).json({ message: 'Queue not ready' });
        }

        channel.sendToQueue(
            'news_queue',
            Buffer.from(JSON.stringify({ id: newsId })),
            { persistent: true }
        );

        res.status(201).send({
            status: 'ok',
            message: 'News stored and queued',
            id: result.rows[0].id,
        });
    } catch (error) {
        console.error('Error inserting news:', error);
        res.status(500).send({ status: 'error', message: 'Validation error' });
    }
})

router.get('/search', async (req, res) => {
    const { q } = req.query;

    const result = await elastic.search({
        index: 'news',
        query: {
            multi_match: {
                query: q,
                fields: ['title', 'content']
            }
        }
    });

    res.json(
        result.hits.hits.map(hit => ({
            id: hit._id,
            ...hit._source
        }))
    );
});

router.get('/setup', async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS news (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                author VARCHAR(100) DEFAULT 'Anonymous',
                source VARCHAR(100) DEFAULT 'Unknown',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.status(200).send({ message: 'Table created successfully' });
    } catch (error) {
        console.error('Error creating table:', error);
        res.status(500).send({ message: 'Error creating table' });
    }
})

module.exports = router;