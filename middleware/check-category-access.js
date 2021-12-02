const errorCodes = require('../routes/errors');
const pool = require('../database');

module.exports = (req, res, next) => {

    const category = req.body.category;

    let sql = "SELECT sku FROM quiz_category WHERE id = ? LIMIT 1";

    pool.query(sql, [category], (err, result) => {
        if (err) {
            console.log(err);
            return res.json({
                error: true,
                code: errorCodes.DB_ERROR,
                message: 'Veritabanı hatası.'
            });
        }

        if (result.length === 0) {
            return res.json({
                error: true,
                code: errorCodes.CATEGORY_NOT_FOUND,
                message: 'Geçersiz kategori.'
            });
        }else {
            if (result[0].sku === null || result[0].sku === undefined) {
                next();
            }else {
                if (req.body.user && req.body.sku) {
                    const user = req.body.user;
                    const sku = req.body.sku;
            
                    const query = 'SELECT * FROM user_purchases WHERE user = ? AND sku = ?';
            
                    pool.query(query, [user, sku], (err, result) => {
                        if (err) {
                            return res.json({
                                error: true,
                                code: errorCodes.DB_ERROR,
                                message: 'Veritabanı hatası.'
                            });
                        }
                        if (result.length === 0) {
                            return res.json({
                                error: true,
                                code: errorCodes.CATEGORY_ACCESS_DENIED,
                                message: 'You don\'t have access to this category. Please purchase it.'
                            });
                        }
                        next();
                    });
                }else {
                    return res.json({
                        error: true,
                        code: errorCodes.NO_USER_OR_CATEGORY_DEFINED,
                        message: 'Either the user id or the category id was not defined.'
                    });
                }
            }
        }
    });
};