const express = require('express');
const db = require('../config');
const mdlconfig = require('../config-module');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const useragent = require('useragent');
const requestIp = require('request-ip');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const secretKey = 'grahak-secret-key';

const comFunction = require('../common_function');
const axios = require('axios');
//const cookieParser = require('cookie-parser');

// const app = express();
// app.use(cookieParser());


//-- Register Function--//
exports.register = (req, res) => {
    //console.log(req.body);

    const { first_name, last_name, email, phone, password, confirm_password, toc } = req.body;

    db.query('SELECT email FROM users WHERE email = ? OR phone = ?', [email, phone], async (err, results) => {
        if (err) {
            // return res.render('sign-up', {
            //     message: 'An error occurred while processing your request' + err
            // })
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        }

        if (results.length > 0) {
            // return res.render('sign-up', {
            //     message: 'Email ID already exist'
            // })
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'Email ID or Phone number already exist'
                }
            )
        }

        let hasPassword = await bcrypt.hash(password, 8);
        //console.log(hasPassword);
        const currentDate = new Date();

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        db.query('INSERT INTO users SET ?', { first_name: first_name, last_name: last_name, email: email, phone: phone, password: hasPassword, user_registered: formattedDate, user_status: 1, user_type_id: 2 }, (err, results) => {
            if (err) {
                // return res.render('sign-up', {
                //     message: 'An error occurred while processing your request' + err
                // })
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request' + err
                    }
                )
            } else {
                //console.log(results,'User Table');
                //-- Insert User data to meta table--------//
                db.query('INSERT INTO user_customer_meta SET ?', { user_id: results.insertId, address: '', country: '', state: '', city: '', zip: '', review_count: 0, date_of_birth: '', occupation: '', gender: '', profile_pic: '' }, (err, results) => {
                    return res.send(
                        {
                            status: 'ok',
                            data: results,
                            message: 'User registered'
                        }
                    )
                })
            }
        })
    })
}

//-- Frontend User Register Function--//
exports.frontendUserRegister = async (req, res) => {
    //console.log(req.body);

    const { first_name, last_name, email, register_password, register_confirm_password } = req.body;

    // Validation: Check if passwords match
    if (register_password !== register_confirm_password) {
        return res.status(400).json({ status: 'err', message: 'Passwords do not match.' });
    }

    try {
        // Check if the email already exists in the "users" table
        const emailExists = await new Promise((resolve, reject) => {
        db.query('SELECT email FROM users WHERE email = ?', [email], (err, results) => {
            if (err) reject(err);
                resolve(results.length > 0);
            });
        });
        if (emailExists) {
            return res.status(400).json({ message: 'Email ID already exists.' });
        }

        // Hash the password asynchronously
        const hashedPassword = await bcrypt.hash(register_password, 8);
        const currentDate = new Date();

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        const userInsertQuery = 'INSERT INTO users (first_name, last_name, email, password, user_registered, user_status, user_type_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
        db.query(userInsertQuery, [first_name, last_name, email, hashedPassword, formattedDate, 1, 2], (err, userResults) => {
            if (err) {
                console.error('Error inserting user into "users" table:', err);
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request' + err
                    }
                )
            }

            // Insert the user into the "user_customer_meta" table
            const userMetaInsertQuery = 'INSERT INTO user_customer_meta (user_id, address, country, state, city, zip, review_count, date_of_birth, occupation, gender, profile_pic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            db.query(userMetaInsertQuery, [userResults.insertId, '', '', '', '', '', 0, '', '', '', ''], (err, metaResults) => {
                if (err) {
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: 'An error occurred while processing your request' + err
                        }
                    )
                }

                const userRegistrationData = {
                    username: email,
                    email: email,
                    password: register_password,
                    first_name: first_name,
                    last_name: last_name,
                };
                axios.post( process.env.BLOG_API_ENDPOINT+'/register', userRegistrationData)
                .then((response) => {
                    //console.log('User registration successful. User ID:', response.data.user_id);
                    return res.send(
                        {
                            status: 'ok',
                            data: response.data.user_id,
                            message: 'User registration successful'
                        }
                    )                  
                })
                .catch((error) => {
                    //console.error('User registration failed:', );
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: error.response.data
                        }
                    )                   
                }); 
            })
        })
    }
    catch (error) {
        console.error('Error during user registration:', error);
        return res.status(500).json({ status: 'err', message: 'An error occurred while processing your request.' });
    }
}


//-- Login Function --//
exports.login = (req, res) => {
    //console.log(req.body);
    const userAgent = req.headers['user-agent'];
    const agent = useragent.parse(userAgent);

    //res.json(deviceInfo);

    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        } else {
            if (results.length > 0) {
                const user = results[0];
                //console.log(user);
                // Compare the provided password with the stored hashed password
                bcrypt.compare(password, user.password, (err, result) => {
                    if (err) {
                        return res.send(
                            {
                                status: 'err',
                                data: '',
                                message: 'Error: ' + err
                            }
                        )
                    }
                    if (result) {
                        //check Administrative Login
                        if (user.user_type_id == 1 && user.user_status == 1) {
                            const query = `
                                        SELECT user_meta.*, c.name as country_name, s.name as state_name
                                        FROM user_customer_meta user_meta
                                        JOIN countries c ON user_meta.country = c.id
                                        JOIN states s ON user_meta.state = s.id
                                        WHERE user_id = ?
                                        `;
                            db.query(query, [user.user_id], async (err, results) => {
                                let userData = {};
                                if (results.length > 0) {
                                    const user_meta = results[0];
                                    //console.log(user_meta,'aaaaaaaa');
                                    // Set a cookie
                                    const dateString = user_meta.date_of_birth;
                                    const date_of_birth_date = new Date(dateString);
                                    const formattedDate = date_of_birth_date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                                    let userData = {
                                        user_id: user.user_id,
                                        first_name: user.first_name,
                                        last_name: user.last_name,
                                        email: user.email,
                                        phone: user.phone,
                                        user_type_id: user.user_type_id,
                                        address: user_meta.address,
                                        country: user_meta.country,
                                        country_name: user_meta.country_name,
                                        state: user_meta.state,
                                        state_name: user_meta.state_name,
                                        city: user_meta.city,
                                        zip: user_meta.zip,
                                        review_count: user_meta.review_count,
                                        date_of_birth: formattedDate,
                                        occupation: user_meta.occupation,
                                        gender: user_meta.gender,
                                        profile_pic: user_meta.profile_pic
                                    };
                                    const encodedUserData = JSON.stringify(userData);
                                    res.cookie('user', encodedUserData);
                                    //console.log(encodedUserData, 'login user data');
                                } else {
                                    // Set a cookie
                                    let userData = {
                                        user_id: user.user_id,
                                        first_name: user.first_name,
                                        last_name: user.last_name,
                                        email: user.email,
                                        phone: user.phone,
                                        user_type_id: user.user_type_id
                                    };
                                    const encodedUserData = JSON.stringify(userData);
                                    res.cookie('user', encodedUserData);
                                }
                                //console.log(userData, 'User data');
                                //-- check last Login Info-----//
                                const device_query = "SELECT * FROM user_device_info WHERE user_id = ?";
                                db.query(device_query, [user.user_id], async (err, device_query_results) => {
                                    const currentDate = new Date();
                                    const year = currentDate.getFullYear();
                                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                                    const day = String(currentDate.getDate()).padStart(2, '0');
                                    const hours = String(currentDate.getHours()).padStart(2, '0');
                                    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
                                    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
                                    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                                    if (device_query_results.length > 0) {
                                        // User exist update info
                                        const device_update_query = 'UPDATE user_device_info SET device_id = ?, IP_address = ?, last_logged_in = ? WHERE user_id = ?';
                                        const values = [agent.toAgent() + ' ' + agent.os.toString(), requestIp.getClientIp(req), formattedDate, user.user_id];
                                        db.query(device_update_query, values, (err, device_update_query_results) => {
                                            return res.send(
                                                {
                                                    status: 'ok',
                                                    data: userData,
                                                    message: 'Login Successfull'
                                                }
                                            )
                                        })
                                    } else {
                                        // User doesnot exist Insert New Row.

                                        const device_insert_query = 'INSERT INTO user_device_info (user_id, device_id, device_token, imei_no, model_name, make_name, IP_address, last_logged_in, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                                        const values = [user.user_id, agent.toAgent() + ' ' + agent.os.toString(), '', '', '', '', requestIp.getClientIp(req), formattedDate, formattedDate];

                                        db.query(device_insert_query, values, (err, device_insert_query_results) => {
                                            return res.send(
                                                {
                                                    status: 'ok',
                                                    data: userData,
                                                    message: 'Login Successfull'
                                                }
                                            )
                                        })

                                    }
                                })
                            })
                        } else {
                            let err_msg = '';
                            if (user.user_status == 0) {
                                err_msg = 'your account is inactive, please contact with administrator.';
                            } else {
                                err_msg = 'You do not have permission to login as administrator.';
                            }
                            return res.send(
                                {
                                    status: 'err',
                                    data: '',
                                    message: err_msg
                                }
                            )
                        }
                    } else {
                        return res.send(
                            {
                                status: 'err',
                                data: '',
                                message: 'Invalid password'
                            }
                        )
                    }
                });
            } else {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'Invalid Email'
                    }
                )
            }
        }
    })
}

//-- Frontend User Login Function--//
exports.frontendUserLogin = (req, res) => {
    //console.log(req.body);
    const userAgent = req.headers['user-agent'];
    const agent = useragent.parse(userAgent);

    //res.json(deviceInfo);

    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        } else {
            if (results.length > 0) {
                const user = results[0];
                //console.log(user);
                // Compare the provided password with the stored hashed password
                bcrypt.compare(password, user.password, (err, result) => {
                    if (err) {
                        return res.send(
                            {
                                status: 'err',
                                data: '',
                                message: 'Error: ' + err
                            }
                        )
                    }
                    if (result) {
                        //check Customer Login
                        if (user.user_type_id == 2 && user.user_status == 1) {
                            const query = `
                                        SELECT user_meta.*, c.name as country_name, s.name as state_name
                                        FROM user_customer_meta user_meta
                                        JOIN countries c ON user_meta.country = c.id
                                        JOIN states s ON user_meta.state = s.id
                                        WHERE user_id = ?
                                        `;
                            db.query(query, [user.user_id], async (err, results) => {
                                let userData = {};
                                if (results.length > 0) {
                                    const user_meta = results[0];
                                    //console.log(user_meta,'aaaaaaaa');
                                    // Set a cookie
                                    const dateString = user_meta.date_of_birth;
                                    const date_of_birth_date = new Date(dateString);
                                    const formattedDate = date_of_birth_date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                                    let userData = {
                                        user_id: user.user_id,
                                        first_name: user.first_name,
                                        last_name: user.last_name,
                                        email: user.email,
                                        phone: user.phone,
                                        user_type_id: user.user_type_id,
                                        address: user_meta.address,
                                        country: user_meta.country,
                                        country_name: user_meta.country_name,
                                        state: user_meta.state,
                                        state_name: user_meta.state_name,
                                        city: user_meta.city,
                                        zip: user_meta.zip,
                                        review_count: user_meta.review_count,
                                        date_of_birth: formattedDate,
                                        occupation: user_meta.occupation,
                                        gender: user_meta.gender,
                                        profile_pic: user_meta.profile_pic
                                    };
                                    //const encodedUserData = JSON.stringify(userData);
                                    res.cookie('user', encodedUserData);
                                    console.log(encodedUserData, 'login user data');
                                } else {
                                    // Set a cookie
                                    let userData = {
                                        user_id: user.user_id,
                                        first_name: user.first_name,
                                        last_name: user.last_name,
                                        email: user.email,
                                        phone: user.phone,
                                        user_type_id: user.user_type_id
                                    };
                                    const encodedUserData = JSON.stringify(userData);
                                    res.cookie('user', encodedUserData);
                                }
                                
                                (async () => {
                                    //---- Login to Wordpress Blog-----//
                                    //let wp_user_data;
                                    try {
                                        const userLoginData = {
                                            email: email,
                                            password: password,
                                        };
                                        // axios.post(process.env.BLOG_API_ENDPOINT + '/login', userLoginData)
                                        // .then((response) => {
                                        //     wp_user_data = response.data.data;
                                        //     console.log('User login successful. Response data:', response.data);
                                        // })
                                        // .catch((error) => {
                                        //     console.error('User login failed. Error:', error);
                                        //     if (error.response && error.response.data) {
                                        //         console.log('Error response data:', error.response.data);
                                        //     }
                                        // });
                                        const response = await axios.post(process.env.BLOG_API_ENDPOINT + '/login', userLoginData);
                                        const wp_user_data = response.data.data;

                                        //-- check last Login Info-----//
                                        const device_query = "SELECT * FROM user_device_info WHERE user_id = ?";
                                        db.query(device_query, [user.user_id], async (err, device_query_results) => {
                                            const currentDate = new Date();
                                            const year = currentDate.getFullYear();
                                            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                                            const day = String(currentDate.getDate()).padStart(2, '0');
                                            const hours = String(currentDate.getHours()).padStart(2, '0');
                                            const minutes = String(currentDate.getMinutes()).padStart(2, '0');
                                            const seconds = String(currentDate.getSeconds()).padStart(2, '0');
                                            const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                                            if (device_query_results.length > 0) {
                                                // User exist update info
                                                const device_update_query = 'UPDATE user_device_info SET device_id = ?, IP_address = ?, last_logged_in = ? WHERE user_id = ?';
                                                const values = [agent.toAgent() + ' ' + agent.os.toString(), requestIp.getClientIp(req), formattedDate, user.user_id];
                                                db.query(device_update_query, values, (err, device_update_query_results) => {
                                                    return res.send(
                                                        {
                                                            status: 'ok',
                                                            data: userData,
                                                            wp_user: wp_user_data,
                                                            message: 'Login Successfull 111222333'
                                                        }
                                                    )
                                                })
                                            } else {
                                                // User doesnot exist Insert New Row.

                                                const device_insert_query = 'INSERT INTO user_device_info (user_id, device_id, device_token, imei_no, model_name, make_name, IP_address, last_logged_in, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                                                const values = [user.user_id, agent.toAgent() + ' ' + agent.os.toString(), '', '', '', '', requestIp.getClientIp(req), formattedDate, formattedDate];

                                                db.query(device_insert_query, values, (err, device_insert_query_results) => {
                                                    return res.send(
                                                        {
                                                            status: 'ok',
                                                            data: userData,
                                                            wp_user: wp_user_data,
                                                            message: 'Login Successfull 111'
                                                        }
                                                    )
                                                })

                                            }
                                        })
                                    } catch (error) {
                                        console.error('User login failed. Error:', error);
                                        if (error.response && error.response.data) {
                                          console.log('Error response data:', error.response.data);
                                        }
                                    }
                                })();
                            })
                        } else {
                            let err_msg = '';
                            if (user.user_status == 0) {
                                err_msg = 'your account is inactive, please contact with administrator.';
                            } else {
                                err_msg = 'Do you want to login as administrator, then please go to proper route';
                            }
                            return res.send(
                                {
                                    status: 'err',
                                    data: '',
                                    message: err_msg
                                }
                            )
                        }
                    } else {
                        return res.send(
                            {
                                status: 'err',
                                data: '',
                                message: 'Invalid password'
                            }
                        )
                    }
                });
            } else {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'Invalid Email'
                    }
                )
            }
        }
    })
}


//--- Create New User ----//
exports.createUser = (req, res) => {
    //console.log(req.body);
    db.query('SELECT email FROM users WHERE email = ? OR phone = ?', [req.body.email, req.body.phone], async (err, results) => {
        if (err) {
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        }

        if (results.length > 0) {

            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'Email ID or Phone number already exist'
                }
            )
        }

        let hasPassword = await bcrypt.hash(req.body.password, 8);
        //console.log(hasPassword);
        const currentDate = new Date();

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        db.query('INSERT INTO users SET ?',
            {
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                email: req.body.email,
                phone: req.body.phone,
                password: hasPassword,
                user_registered: formattedDate,
                user_status: 1,
                user_type_id: req.body.user_type_id
            }, (err, results) => {
                if (err) {
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: 'An error occurred while processing your request' + err
                        }
                    )
                } else {
                    //console.log(results,'User Table');
                    //-- Insert User data to meta table--------//
                    var insert_values = [];
                    if (req.file) {
                        insert_values = [results.insertId, req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, 0, req.body.date_of_birth, req.body.occupation, req.body.gender, req.file.filename];
                    } else {
                        insert_values = [results.insertId, req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, 0, req.body.date_of_birth, req.body.occupation, req.body.gender, ''];
                    }

                    const insertQuery = 'INSERT INTO user_customer_meta (user_id, address, country, state, city, zip, review_count, date_of_birth, occupation, gender, profile_pic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                    db.query(insertQuery, insert_values, (error, results, fields) => {
                        if (err) {
                            console.log(err);
                        } else {
                            var mailOptions = {
                                from: 'vivek@scwebtech.com',
                                to: req.body.email,
                                subject: 'Test Message From Bolo Grahak',
                                text: 'Test Message bidy'
                            }
                            mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log('Mail Send: ', info.response);
                                }
                            })
                            return res.send(
                                {
                                    status: 'ok',
                                    data: results,
                                    message: 'New user created'
                                }
                            )
                        }
                    });
                }
            })
    })
}

//Create New Category
exports.createCategory = (req, res) => {
    //console.log('category', req.body);
    const { cat_name, cat_parent_id, country } = req.body;
    const cat_sql = "SELECT category_name FROM category WHERE category_name = ?";
    db.query(cat_sql, cat_name, (cat_err, cat_result) => {
        if (cat_err) throw cat_err;
        if (cat_result.length > 0) {
            return res.send(
                {
                    status: 'Not ok',
                    message: 'Category name already exists '
                }
            )
        } else {
            if (req.file) {
                if (cat_parent_id == '') {
                    const val = [cat_name, 0, req.file.filename];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img) VALUES (?, ?, ?)';
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${result.insertId}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'New Category created'
                                }
                            )
                        }
                    })
                } else {
                    const val = [cat_name, cat_parent_id, req.file.filename];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img) VALUES (?, ?, ?)';
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${result.insertId}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'New Category created'
                                }
                            )
                        }
                    })
                }
            } else {
                if (cat_parent_id == '') {
                    const val = [cat_name, 0, 'NULL'];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img) VALUES (?, ?, ?)';
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${result.insertId}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'New Category created'
                                }
                            )
                        }
                    })
                } else {
                    const val = [cat_name, cat_parent_id, 'NULL'];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img) VALUES (?, ?, ?)';
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${result.insertId}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'New Category created'
                                }
                            )
                        }
                    })
                }
            }
        }
    })

}

//Update Category
exports.updateCategory = (req, res) => {
    console.log('category', req.body, req.file);
    const { cat_id, cat_name, cat_parent_id, country } = req.body;
    const check_arr = [cat_name, cat_id]
    const cat_sql = "SELECT category_name FROM category WHERE category_name = ? AND ID != ?";
    db.query(cat_sql, check_arr, (cat_err, cat_result) => {
        if (cat_err) throw cat_err;
        if (cat_result.length > 0) {
            return res.send(
                {
                    status: 'Not ok',
                    message: 'Category name already exists '
                }
            )
        } else {
            if (req.file) {
                const file_query = `SELECT category_img FROM category WHERE ID = ${cat_id}`;
                db.query(file_query, async function (img_err, img_res) {
                    console.log(img_res);
                    if (img_res[0].category_img != 'NULL') {
                        const filename = img_res[0].category_img;
                        const filePath = `uploads/${filename}`;
                        console.log(filePath);

                        fs.unlink(filePath, await function () {
                            console.log('file deleted');
                        })
                    }
                })
                if (cat_parent_id == '') {
                    const val = [cat_name, req.file.filename, cat_id];
                    const sql = `UPDATE category SET category_name = ?, category_img = ? WHERE ID = ?`;
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            const delete_query = `DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`;
                            db.query(`DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`, await function (del_err, del_res) {

                            });
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${cat_id}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'Category updated'
                                }
                            )
                        }
                    })
                } else {
                    const val = [cat_name, cat_parent_id, req.file.filename, cat_id];

                    const sql = `UPDATE category SET category_name = ?, parent_id = ?, category_img = ? WHERE ID = ?`;
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            const delete_query = `DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`;
                            db.query(`DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`, await function (del_err, del_res) {

                            });

                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${cat_id}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'Category updated'
                                }
                            )
                        }
                    })
                }

            } else {
                if (cat_parent_id == '') {
                    const val = [cat_name, cat_id];

                    const sql = `UPDATE category SET category_name = ? WHERE ID = ?`;
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            const delete_query = `DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`;
                            db.query(`DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`, await function (del_err, del_res) {

                            });
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${cat_id}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'Category updated'
                                }
                            )
                        }
                    })
                } else {
                    const val = [cat_name, cat_parent_id, cat_id];

                    const sql = `UPDATE category SET category_name = ?, parent_id = ?  WHERE ID = ?`;
                    db.query(sql, val, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            const delete_query = `DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`;
                            db.query(`DELETE FROM category_country_relation WHERE cat_id = ${cat_id}`, await function (del_err, del_res) {

                            });
                            for (var i = 0; i < country.length; i++) {
                                db.query(`INSERT INTO category_country_relation (cat_id , country_id) VALUES (${cat_id}, ${country[i]} )`, await function (err, country_val) {
                                    if (err) throw err;

                                });
                            }
                            return res.send(
                                {
                                    status: 'ok',
                                    data: result,
                                    message: 'Category updated'
                                }
                            )
                        }
                    })
                }
            }
        }
    })
}

//-- User Profile Edit --//
exports.editUserData = (req, res) => {
    //console.log(req.body);
    const userId = req.body.user_id;

    const checkQuery = 'SELECT user_id FROM users WHERE phone = ? AND user_id <> ?';
    db.query(checkQuery, [req.body.phone, userId], (checkError, checkResults) => {
        if (checkError) {
            //console.log(checkError)
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + checkError
                }
            )
        }

        if (checkResults.length > 0) {
            // Phone number already exists for another user
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'Phone number already exists for another user'
                }
            )
        } else {
            // Update the user's data
            const updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, phone = ?, user_type_id = ? WHERE user_id = ?';
            db.query(updateQuery, [req.body.first_name, req.body.last_name, req.body.phone, req.body.user_type_id, userId], (updateError, updateResults) => {

                if (updateError) {
                    //console.log(updateError);
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: 'An error occurred while processing your request' + updateError
                        }
                    )
                } else {
                    // Update the user's meta data

                    if (req.file) {
                        // Unlink (delete) the previous file
                        const unlinkprofilePicture = "uploads/"+req.body.previous_profile_pic;
                        fs.unlink(unlinkprofilePicture, (err) => {
                            if (err) {
                                //console.error('Error deleting file:', err);
                              } else {
                                //console.log('Previous file deleted');
                              }
                        });
                        //const profilePicture = req.file;
                        //console.log(profilePicture);

                        const updateQueryMeta = 'UPDATE user_customer_meta SET address = ?, country = ?, state = ?, city = ?, zip = ?, date_of_birth = ?, occupation = ?, gender = ?, profile_pic = ? WHERE user_id = ?';
                        db.query(updateQueryMeta, [req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, req.body.date_of_birth, req.body.occupation, req.body.gender, req.file.filename, userId], (updateError, updateResults) => {
                            if (updateError){
                                return res.send(
                                    {
                                        status: 'err',
                                        data: userId,
                                        message: 'An error occurred while processing your request' + updateError
                                    }
                                )
                            }else{
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: userId,
                                        message: 'Update Successfull'
                                    }
                                )
                            }
                        });

                    } else {
                        const updateQueryMeta = 'UPDATE user_customer_meta SET address = ?, country = ?, state = ?, city = ?, zip = ?, date_of_birth = ?, occupation = ?, gender = ? WHERE user_id = ?';
                        db.query(updateQueryMeta, [req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, req.body.date_of_birth, req.body.occupation, req.body.gender, userId], (updateError, updateResults) => {
                            if (updateError){
                                return res.send(
                                    {
                                        status: 'err',
                                        data: '',
                                        message: 'An error occurred while processing your request' + updateError
                                    }
                                )
                            }else{
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: userId,
                                        message: 'Update Successfull'
                                    }
                                )
                            }
                        });
                    }

                }



            });
        }
    });
}

//--- Create New Company ----//
exports.createCompany = (req, res) => {
    //console.log(req.body);
    const encodedUserData = req.cookies.user;
    const currentUserData = JSON.parse(encodedUserData);

    db.query('SELECT comp_email FROM company WHERE comp_email = ? OR comp_phone = ?', [req.body.comp_email, req.body.comp_phone], async (err, results) => {
        if (err) {
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        }

        if (results.length > 0) {
            
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'Email ID or Phone number already exist for another Company'
                }
            )
        }

        const currentDate = new Date();

        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(currentDate.getSeconds()).padStart(2, '0');

        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        var insert_values = [];
        if (req.file) {
            insert_values = [ currentUserData.user_id, req.body.company_name, req.file.filename, req.body.comp_phone, req.body.comp_email, req.body.comp_registration_id, formattedDate, formattedDate ];
        } else {
            insert_values = [ currentUserData.user_id, req.body.company_name, '', req.body.comp_phone, req.body.comp_email, req.body.comp_registration_id, formattedDate, formattedDate ];
        }

        const insertQuery = 'INSERT INTO company (user_created_by, company_name, logo, comp_phone, comp_email, comp_registration_id, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(insertQuery, insert_values, (err, results, fields) => {
            if (err) {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request' + err
                    }
                )
            } else {
                const companyId = results.insertId;
                const companyCategoryData = req.body.category.map((categoryID) => [companyId, categoryID]); 
                db.query('INSERT INTO company_cactgory_relation (company_id, category_id) VALUES ?', [companyCategoryData], function (error, results) { 
                    if (error) {                     
                        console.log(error);                     
                        res.status(400).json({                         
                            status: 'err',                         
                            message: 'Error while creating company category'                     
                        });                 
                    }
                    else {
                        return res.send(
                            {
                                status: 'ok',
                                data: companyId,
                                message: 'New company created'
                            }
                        )
                    }
                });
            }
        })
    })
}

//-- Company Edit --//
exports.editCompany = (req, res) => {
    //console.log(req.body);
    const companyID = req.body.company_id;
    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Check if the updated email ID or phone number already exist for another company
    const checkQuery = 'SELECT * FROM company WHERE (comp_email = ? OR comp_phone = ?) AND ID != ?';
    const checkValues = [req.body.comp_email, req.body.comp_phone, companyID];

    db.query(checkQuery, checkValues, (err, results) => {
        if (err) {
            //console.log(err)
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        }

        if (results.length > 0) {
            // Email ID or phone number already exist for another company
            return res.send({
              status: 'err',
              data: '',
              message: 'Email ID or phone number already exist for another company'
            });
        }

        // Update company details in the company table
        const updateQuery = 'UPDATE company SET company_name = ?, logo = ?, comp_phone = ?, comp_email = ?, comp_registration_id = ?, updated_date = ? WHERE ID = ?';
        const updateValues = [req.body.company_name, '', req.body.comp_phone, req.body.comp_email, req.body.comp_registration_id, formattedDate, companyID];

        if (req.file) {
            // Unlink (delete) the previous file
            const unlinkcompanylogo = "uploads/"+req.body.previous_logo;
            fs.unlink(unlinkcompanylogo, (err) => {
                if (err) {
                    //console.error('Error deleting file:', err);
                  } else {
                    //console.log('Previous file deleted');
                  }
            });

            updateValues[1] = req.file.filename;
        }
        db.query(updateQuery, updateValues, (err, results) => {
            if (err) {
                // Handle the error
                return res.send({
                  status: 'err',
                  data: '',
                  message: 'An error occurred while updating the company details: ' + err
                });
            }

            // Update company categories in the company_cactgory_relation table
            const deleteQuery = 'DELETE FROM company_cactgory_relation WHERE company_id = ?';
            db.query(deleteQuery, [companyID], (err) => {
                if (err) {
                    // Handle the error
                    return res.send({
                      status: 'err',
                      data: '',
                      message: 'An error occurred while deleting existing company categories: ' + err
                    });
                }

                const categories = req.body.category; // Assuming company_categories is an array of category IDs

                // Create an array of arrays for bulk insert
                const insertValues = categories.map(categoryId => [companyID, categoryId]);

                const insertQuery = 'INSERT INTO company_cactgory_relation (company_id, category_id) VALUES ?';

                db.query(insertQuery, [insertValues], (err) => {
                    if (err) {
                        // Handle the error
                        return res.send({
                          status: 'err',
                          data: '',
                          message: 'An error occurred while updating company categories: ' + err
                        });
                    }
                    
                    // Return success response
                    return res.send({
                        status: 'ok',
                        data: companyID,
                        message: 'Company details updated successfully'
                    });
                })
            })
        })
    })
}

exports.createRatingTags = (req, res) => {
    console.log(req.body);
    const ratingTagsArray = JSON.parse(req.body.rating_tags);
    // Extract the "value" property from each object in the array
    const ratingValues = ratingTagsArray.map(tag => tag.value);
    // Join the values with the "|" separator
    const formattedRatingTags = ratingValues.join('|');

    console.log('rating_tags:', formattedRatingTags);

    //-- Checking review_rating_value already exist or Not
    db.query('SELECT * FROM review_rating_tags WHERE review_rating_value = ?', [req.body.review_rating_value], async (err, results) => {
        if (err) {
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request' + err
                }
            )
        }

        if (results.length > 0) {
            
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'Tag already added for this rating value.'
                }
            )
        }

        insert_values = [ req.body.review_rating_value, req.file.filename, formattedRatingTags ];
        var insert_values = [];
        if (req.file) {
            insert_values = [ req.body.review_rating_value, req.file.filename, formattedRatingTags ];
        } else {
            insert_values = [ req.body.review_rating_value, '', formattedRatingTags ];
        }

        const insertQuery = 'INSERT INTO review_rating_tags (review_rating_value, rating_image, rating_tags) VALUES (?, ?, ?)';
        db.query(insertQuery, insert_values, (err, results, fields) => {
            if (err) {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request' + err
                    }
                )
            } else {
                const rowID = results.insertId;
                return res.send(
                    {
                        status: 'ok',
                        data: rowID,
                        message: 'Tag successfully added'
                    }
                )
            }
        })
    })
}

exports.editRatingTags = (req, res) => {
    //console.log(req.body);
    const row_id = req.body.row_id;

    const ratingTagsArray = JSON.parse(req.body.rating_tags);
    // Extract the "value" property from each object in the array
    const ratingValues = ratingTagsArray.map(tag => tag.value);
    // Join the values with the "|" separator
    const formattedRatingTags = ratingValues.join('|');

    // Update company details in the company table
    const updateQuery = 'UPDATE review_rating_tags SET rating_image = ?, rating_tags = ? WHERE id = ?';

    var updateValues = [];
    if (req.file) {
        // Unlink (delete) the previous file
        const unlinkcompanylogo = "uploads/"+req.body.previous_rating_image;
        fs.unlink(unlinkcompanylogo, (err) => {
            if (err) {
                //console.error('Error deleting file:', err);
                } else {
                //console.log('Previous file deleted');
                }
        });
        updateValues = [ req.file.filename, formattedRatingTags, row_id ];
    } else {
        updateValues = [ req.body.previous_rating_image, formattedRatingTags, row_id ];
    }
    
    db.query(updateQuery, updateValues, (err, results) => {
        if (err) {
            // Handle the error
            return res.send({
                status: 'err',
                data: '',
                message: 'An error occurred while updating the company details: ' + err
            });
        }

        // Return success response
        return res.send({
            status: 'ok',
            data: '',
            message: 'Tags updated successfully'
        });
    })
}



// Update Contacts
exports.updateContacts = async (req, res) => {
    //const formdata = JSON.parse(req.body.formData);
    console.log('Request Form DATA:', req.body.whatsapp_no);
    const { contacts_id, social_id, whatsapp_no, phone_no, email, title, meta_title, meta_desc, meta_keyword, fb_link, twitter_link, linkedin_link, instagram_link, youtube_link } = req.body
    const contact_sql = `UPDATE contacts SET whatsapp_no=?,phone_no=?,email=?,title=?,meta_title=?,meta_desc=?,meta_keyword=? WHERE id = ?`;
    const contact_data = [whatsapp_no, phone_no, email, title, meta_title, meta_desc, meta_keyword, contacts_id];
    db.query(contact_sql, contact_data, (err, result) => {
        const socials_sql = `UPDATE socials SET facabook=?,linkedin=?,instagram=?,youtube=?,twitter=? WHERE id=?`;
        const socials_data = [fb_link, linkedin_link, instagram_link, youtube_link, twitter_link, social_id];
        db.query(socials_sql, socials_data, (socials_err, socials_result) => {
            // Return success response
            return res.send({
                status: 'ok',
                message: 'Contact details and social links updated successfully'
            });
        })
    })
}

// Contacts Feedback
exports.contactFeedback = (req, res) => {
    const phone = req.body.phone_no;
    const message = req.body.message;
    console.log(__dirname);
    var mailOptions = {
        from: 'vivek@scwebtech.com',
        to: 'pranab@scwebtech.com',
        subject: 'Feedback Mail From Contact',
        //html: ejs.renderFile(path.join(process.env.BASE_URL, '/views/email-template/', 'feedback.ejs'), { phone: phone, message: message })
        html: `<div style="padding- bottom: 30px; font - size: 17px; ">
            <strong> Bolo Grahok Team </strong>
                        </div >
        <div style=padding-bottom: 30px">
            <h3>Client Feedback</h3><br>
                <p><strong>Phone No:</strong>
                    ${phone}
                </p>
                <p><strong>Feedback:</strong></p>
                    <p>
                        ${message}
                    </p>
                </div>`
    }
    mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
        } else {
            console.log('Mail Send: ', info.response);
            return res.send({
                status: 'ok',
                message: 'Thank you for your feedback'
            });
        }
    })
}

// Create FAQ
exports.createFAQ = (req, res) => {
    console.log(JSON.parse(req.body.formData));

    //console.log('FAQ', req.body.formData.FAQ);
    //JSON.parse(req.body.formData)
}

// Create Home
exports.createHome = async (req, res) => {
    // console.log('home', req.body);
    // console.log('file', req.files);
    const form_data = req.body;

    const { home_id, title, meta_title, meta_desc, meta_keyword, bannner_content, for_business,
        for_customer, cus_right_content, cus_right_button_link, cus_right_button_text,
        youtube_1, youtube_2, youtube_3, youtube_4, fb_widget, twitter_widget,
        org_responsibility_content, org_responsibility_buttton_link, org_responsibility_buttton_text,
        about_us_content, about_us_button_link, about_us_button_text } = req.body;

    const { banner_img_1, banner_img_2, banner_img_3, cus_right_img_1, cus_right_img_2, cus_right_img_3, cus_right_img_4, cus_right_img_5,
        cus_right_img_6, cus_right_img_7, cus_right_img_8, org_responsibility_img_1, org_responsibility_img_2, org_responsibility_img_3,
        org_responsibility_img_4, org_responsibility_img_5, org_responsibility_img_6, org_responsibility_img_7, org_responsibility_img_8,
        about_us_img } = req.files;

    const meta_value = [bannner_content, for_business,
        for_customer, cus_right_content, cus_right_button_link, cus_right_button_text,
        youtube_1, youtube_2, youtube_3, youtube_4, fb_widget, twitter_widget,
        org_responsibility_content, org_responsibility_buttton_link, org_responsibility_buttton_text,
        about_us_content, about_us_button_link, about_us_button_text];

    const meta_key = ['bannner_content', 'for_business',
        'for_customer', 'cus_right_content', 'cus_right_button_link', 'cus_right_button_text',
        'youtube_1', 'youtube_2', 'youtube_3', 'youtube_4', 'fb_widget', 'twitter_widget',
        'org_responsibility_content', 'org_responsibility_buttton_link', 'org_responsibility_buttton_text',
        'about_us_content', 'about_us_button_link', 'about_us_button_text'];

    await meta_value.forEach((element, index) => {
        //console.log(element, index);
        const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
        const check_data = [home_id, meta_key[index]];
        db.query(check_sql, check_data, (check_err, check_result) => {
            if (check_err) {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request'
                    }
                )
            } else {
                if (check_result.length > 0) {
                    const update_sql = `UPDATE page_meta SET page_meta_value = ? WHERE page_id = ? AND page_meta_key = ?`;
                    const update_data = [element, home_id, meta_key[index]];
                    db.query(update_sql, update_data, (update_err, update_result) => {
                        if (update_err) throw update_err;
                    })
                } else {
                    const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                    const insert_data = [home_id, meta_key[index], element];
                    db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                        if (insert_err) throw insert_err;
                    })
                }
            }
        });
    });

    const file_meta_value = [banner_img_1, banner_img_2, banner_img_3, cus_right_img_1, cus_right_img_2, cus_right_img_3, cus_right_img_4, cus_right_img_5,
        cus_right_img_6, cus_right_img_7, cus_right_img_8, org_responsibility_img_1, org_responsibility_img_2, org_responsibility_img_3,
        org_responsibility_img_4, org_responsibility_img_5, org_responsibility_img_6, org_responsibility_img_7, org_responsibility_img_8,
        about_us_img];

    const file_meta_key = ['banner_img_1', 'banner_img_2', 'banner_img_3', 'cus_right_img_1', 'cus_right_img_2', 'cus_right_img_3', 'cus_right_img_4', 'cus_right_img_5',
        'cus_right_img_6', 'cus_right_img_7', 'cus_right_img_8', 'org_responsibility_img_1', 'org_responsibility_img_2', 'org_responsibility_img_3',
        'org_responsibility_img_4', 'org_responsibility_img_5', 'org_responsibility_img_6', 'org_responsibility_img_7', 'org_responsibility_img_8',
        'about_us_img'];

    await file_meta_key.forEach((item, key) => {
        //console.log(item, key);
        if (req.files[item]) {
            //console.log(file_meta_value[key][0].filename);
            const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
            const check_data = [home_id, item];
            db.query(check_sql, check_data, (check_err, check_result) => {
                if (check_err) {
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: 'An error occurred while processing your request'
                        }
                    )
                } else {
                    if (check_result.length > 0) {
                        const update_sql = `UPDATE page_meta SET page_meta_value = ? WHERE page_id = ? AND page_meta_key = ?`;
                        const update_data = [file_meta_value[key][0].filename, home_id, item];
                        db.query(update_sql, update_data, (update_err, update_result) => {
                            if (update_err) throw update_err;
                        })
                    } else {
                        const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                        const insert_data = [home_id, item, file_meta_value[key][0].filename];
                        db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                            if (insert_err) throw insert_err;
                        })
                    }
                }
            });
        }

    });

    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
    const title_data = [title, meta_title, meta_desc, meta_keyword, home_id];
    console.log(title_data);
    db.query(title_sql, title_data, (title_err, title_result) => {
        return res.send(
            {
                status: 'ok',
                data: '',
                message: 'Title update successfully'
            }
        )
    })
}