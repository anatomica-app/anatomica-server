const pool = require('../database');

module.exports = (req, res, next) => {

    const category = req.body.category;

    let sql = "SELECT sku FROM quiz_category WHERE id = ? LIMIT 1";

    pool.query(sql, [category], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({
                message: 'Veritabanı hatası.'
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                message: 'Geçersiz kategori.'
            });
        } else {
            if (result[0].sku === null || result[0].sku === undefined) {
                next();
            } else {
                if (req.body.user && req.body.sku) {
                    const user = req.body.user;
                    const sku = req.body.sku;

                    const query = 'SELECT * FROM user_purchases WHERE user = ? AND sku = ?';

                    pool.query(query, [user, sku], (err, result) => {
                        if (err) {
                            return res.status(500).json({
                                message: 'Veritabanı hatası.'
                            });
                        }
                        if (result.length === 0) {
                            return res.status(401).json({
                                message: 'You don\'t have access to this category. Please purchase it.'
                            });
                        }
                        next();
                    });
                } else {
                    return res.status(400).json({
                        message: 'Either the user id or the category id was not defined.'
                    });
                }
            }
        }
    });
};