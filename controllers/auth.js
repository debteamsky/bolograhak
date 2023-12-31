const util = require('util');
const express = require('express');
const db = require('../config');

const mdlconfig = require('../config-module');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const useragent = require('useragent');
const requestIp = require('request-ip');
const fs = require('fs');
const ExcelJS = require('exceljs');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });
const bodyParser = require('body-parser');
const querystring = require('querystring');
const app = express();
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
var cron = require('node-cron');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const query = util.promisify(db.query).bind(db);
const mysql = require('mysql2/promise');
const dbConfig = {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
};
const secretKey = 'grahak-secret-key';

const comFunction = require('../common_function');
const comFunction2 = require('../common_function2');
const axios = require('axios');

const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.DESIRED_TIMEZONE,
    hour12: true, // Set to true or false based on your preference
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });


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

         db.query('INSERT INTO users SET ?', { first_name: first_name, last_name: last_name, email: email, phone: phone, password: hasPassword, user_registered: formattedDate, user_status: 1, user_type_id: 2 },  (err, results) => {
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
    console.log(req.body);

    const { first_name, last_name, email, register_password, register_confirm_password } = req.body;

    // Validation: Check if passwords match
    if (register_password !== register_confirm_password) {
        return res.status(400).json({ status: 'err', message: 'Passwords do not match.' });
    }

    try {
        // Check if the email already exists in the "users" table
        const emailExists = await new Promise((resolve, reject) => {
            db.query('SELECT email, register_from FROM users WHERE email = ?', [email], (err, results) => {
                if (err) reject(err);

                if (results.length > 0) {
                    var register_from = results[0].register_from;
                    if(register_from=='web'){
                        var message = 'Email ID already exists, Please login with your email-ID and password';
                    }else{
                        if(register_from=='gmail'){
                            register_from = 'google';
                        }
                        var message = 'Email ID already exists, login with '+register_from;
                    }
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: message
                        }
                    )
                }

                resolve(results.length > 0);
            });
        });

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

        const userInsertQuery = 'INSERT INTO users (first_name, last_name, email, password, register_from, user_registered, user_status, user_type_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(userInsertQuery, [first_name, last_name, email, hashedPassword, 'web', formattedDate, 1, 2], async (err, userResults) => {
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
            var mailOptions = {
                from: process.env.MAIL_USER,
                //to: 'pranab@scwebtech.com',
                to: email,
                subject: 'Welcome Email',
                html: `<div id="wrapper" dir="ltr" style="background-color: #f5f5f5; margin: 0; padding: 70px 0 70px 0; -webkit-text-size-adjust: none !important; width: 100%;">
                <table height="100%" border="0" cellpadding="0" cellspacing="0" width="100%">
                 <tbody>
                  <tr>
                   <td align="center" valign="top">
                     <div id="template_header_image"><p style="margin-top: 0;"></p></div>
                     <table id="template_container" style="box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; background-color: #fdfdfd; border: 1px solid #dcdcdc; border-radius: 3px !important;" border="0" cellpadding="0" cellspacing="0" width="600">
                      <tbody>
                        <tr>
                         <td align="center" valign="top">
                           <!-- Header -->
                           <table id="template_header" style="background-color: #000; border-radius: 3px 3px 0 0 !important; color: #ffffff; border-bottom: 0; font-weight: bold; line-height: 100%; vertical-align: middle; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif;" border="0" cellpadding="0" cellspacing="0" width="600">
                             <tbody>
                               <tr>
                               <td><img alt="Logo" src="${process.env.MAIN_URL}assets/media/logos/email-template-logo.png"  style="padding: 30px 40px; display: block;  width: 70px;" /></td>
                                <td id="header_wrapper" style="padding: 36px 48px; display: block;">
                                   <h1 style="color: #FCCB06; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 30px; font-weight: bold; line-height: 150%; margin: 0; text-align: left;">Welcome Email</h1>
                                </td>
          
                               </tr>
                             </tbody>
                           </table>
                     <!-- End Header -->
                     </td>
                        </tr>
                        <tr>
                         <td align="center" valign="top">
                           <!-- Body -->
                           <table id="template_body" border="0" cellpadding="0" cellspacing="0" width="600">
                             <tbody>
                               <tr>
                                <td id="body_content" style="background-color: #fdfdfd;" valign="top">
                                  <!-- Content -->
                                  <table border="0" cellpadding="20" cellspacing="0" width="100%">
                                   <tbody>
                                    <tr>
                                     <td style="padding: 48px;" valign="top">
                                       <div id="body_content_inner" style="color: #737373; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 14px; line-height: 150%; text-align: left;">
                                        
                                        <table border="0" cellpadding="4" cellspacing="0" width="90%">
                                          <tr>
                                            <td colspan="2">
                                                <strong>Hello ${first_name},</strong>
                                                <p style="font-size:15px; line-height:20px">Warm greetings from the Bolo Grahak team!
                                                You have joined a community dedicated to empowering all Grahaks (Customers) and ensuring their voices are heard <b>LOUD</b> and <b>C L E A R</b>.</p>
                                                <p style="font-size:15px; line-height:20px"> Keep sharing your Customer experiences (positive or negative), read about others' experience and get to know Customer centric information.</p>
                                                <p style="font-size:15px; line-height:20px">Share this platform with all your friends and family.
                                                Together, we can make Organisations listen and improve because <b>#CustomersHavePower</b>.</p><p style="font-size:15px; line-height:20px">Let's usher in this Customer Revolution coz <b>#CustomerRightsMatter</b>.</p><p style="font-size:15px; line-height:20px">Welcome Onboard!</p><br><p style="font-size:15px; line-height:20px">Kind Regards,</p><p style="font-size:15px; line-height:20px">Bolo Grahak Team</p><br>
                                            </td>
                                          </tr>
                                        </table>
                                        <p style="font-size:15px; line-height:20px">Download the app from Google Playstore or visit  <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak.com </a>.</p>
                                       </div>
                                     </td>
                                    </tr>
                                   </tbody>
                                  </table>
                                <!-- End Content -->
                                </td>
                               </tr>
                             </tbody>
                           </table>
                         <!-- End Body -->
                         </td>
                        </tr>
                        <tr>
                         <td align="center" valign="top">
                           <!-- Footer -->
                           <table id="template_footer" border="0" cellpadding="10" cellspacing="0" width="600">
                            <tbody>
                             <tr>
                              <td style="padding: 0; -webkit-border-radius: 6px;" valign="top">
                               <table border="0" cellpadding="10" cellspacing="0" width="100%">
                                 <tbody>
                                   <tr>
                                    <td colspan="2" id="credit" style="padding: 20px 10px 20px 10px; -webkit-border-radius: 0px; border: 0; color: #fff; font-family: Arial; font-size: 12px; line-height: 125%; text-align: center; background:#000" valign="middle">
                                         <p>This email was sent from <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a></p>
                                    </td>
                                   </tr>
                                 </tbody>
                               </table>
                              </td>
                             </tr>
                            </tbody>
                           </table>
                         <!-- End Footer -->
                         </td>
                        </tr>
                      </tbody>
                     </table>
                   </td>
                  </tr>
                 </tbody>
                </table>
               </div>`
              }
                await mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
                  if (err) {
                      console.log(err);
                      return res.send({
                          status: 'not ok',
                          message: 'Something went wrong'
                      });
                  } else {
                      console.log('Mail Send: ', info.response);
                      return res.send({
                          status: 'ok',
                          message: ''
                      });
                  }
                })
            // Insert the user into the "user_customer_meta" table
            const userMetaInsertQuery = 'INSERT INTO user_customer_meta (user_id, review_count) VALUES (?, ?)';
            db.query(userMetaInsertQuery, [userResults.insertId, 0], (err, metaResults) => {
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
                axios.post(process.env.BLOG_API_ENDPOINT + '/register', userRegistrationData)
                    .then((response) => {
                        //console.log('User registration successful. User ID:', response.data.user_id);

                        //-------User Auto Login --------------//
                        const userAgent = req.headers['user-agent'];
                        const agent = useragent.parse(userAgent);

                        // Set a cookie
                        const userData = {
                            user_id: userResults.insertId,
                            first_name: first_name,
                            last_name: last_name,
                            email: email,
                            user_type_id: 2
                        };
                        const encodedUserData = JSON.stringify(userData);
                        res.cookie('user', encodedUserData);

                        (async () => {
                            //---- Login to Wordpress Blog-----//
                            //let wp_user_data;
                            try {
                                const userLoginData = {
                                    email: email,
                                    password: register_password,
                                };
                                const response = await axios.post(process.env.BLOG_API_ENDPOINT + '/login', userLoginData);
                                const wp_user_data = response.data.data;

                                //-- check last Login Info-----//
                                const device_query = "SELECT * FROM user_device_info WHERE user_id = ?";
                                db.query(device_query, [userResults.insertId], async (err, device_query_results) => {
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
                                        const values = [agent.toAgent() + ' ' + agent.os.toString(), requestIp.getClientIp(req), formattedDate, userResults.insertId];
                                        db.query(device_update_query, values, (err, device_update_query_results) => {
                                            return res.send(
                                                {
                                                    status: 'ok',
                                                    data: userData,
                                                    wp_user: wp_user_data,
                                                    currentUrlPath: req.body.currentUrlPath,
                                                    message: 'Registration successful you are automatically login to your dashboard'
                                                }
                                            )
                                        })
                                    } else {
                                        // User doesnot exist Insert New Row.

                                        const device_insert_query = 'INSERT INTO user_device_info (user_id, device_id, device_token, imei_no, model_name, make_name, IP_address, last_logged_in, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                                        const values = [userResults.insertId, agent.toAgent() + ' ' + agent.os.toString(), '', '', '', '', requestIp.getClientIp(req), formattedDate, formattedDate];

                                        db.query(device_insert_query, values, (err, device_insert_query_results) => {
                                            return res.send(
                                                {
                                                    status: 'ok',
                                                    data: userData,
                                                    wp_user: wp_user_data,
                                                    currentUrlPath: req.body.currentUrlPath,
                                                    message: 'Registration successful you are automatically login to your dashboard'
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
                                        SELECT user_meta.*, c.name as country_name, s.name as state_name, ccr.company_id as claimed_comp_id, company.slug
                                        FROM user_customer_meta user_meta
                                        LEFT JOIN countries c ON user_meta.country = c.id
                                        LEFT JOIN states s ON user_meta.state = s.id
                                        LEFT JOIN company_claim_request ccr ON user_meta.user_id = ccr.claimed_by
                                        LEFT JOIN company ON company.ID = ccr.company_id
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
                                        profile_pic: user_meta.profile_pic,
                                        claimed_comp_id: user_meta.claimed_comp_id,
                                        claimed_comp_slug: user_meta.slug
                                    };
                                    const encodedUserData = JSON.stringify(userData);
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
                                        user_type_id: user.user_type_id,
                                        claimed_comp_id: '',
                                        claimed_comp_slug: ''
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
                                                            currentUrlPath: req.body.currentUrlPath,
                                                            message: 'Login Successful'
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
                                                            currentUrlPath: req.body.currentUrlPath,
                                                            message: 'Login Successful'
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
                        if ((user.user_type_id == 1 || user.user_type_id == 3) && user.user_status == 1) {
                            const query = `
                                        SELECT user_meta.*, c.name as country_name, s.name as state_name, ccr.company_id as claimed_comp_id, company.slug
                                        FROM user_customer_meta user_meta
                                        LEFT JOIN countries c ON user_meta.country = c.id
                                        LEFT JOIN states s ON user_meta.state = s.id
                                        LEFT JOIN company_claim_request ccr ON user_meta.user_id = ccr.claimed_by
                                        LEFT JOIN company ON company.ID = ccr.company_id
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
                                        profile_pic: user_meta.profile_pic,
                                        claimed_comp_id: user_meta.claimed_comp_id,
                                        claimed_comp_slug: user_meta.slug
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
                                        user_type_id: user.user_type_id,
                                        claimed_comp_id: '',
                                        claimed_comp_slug: ''
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


//--- Create New User ----//
exports.createUser = (req, res) => {
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
                        insert_values = [results.insertId, req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, 0, req.body.date_of_birth, req.body.occupation, req.body.gender, req.file.filename, req.body.alternate_phone, req.body.marital_status, req.body.about];
                    } else {
                        insert_values = [results.insertId, req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, 0, req.body.date_of_birth, req.body.occupation, req.body.gender, '', req.body.alternate_phone, req.body.marital_status, req.body.about];
                    }

                    const insertQuery = 'INSERT INTO user_customer_meta (user_id, address, country, state, city, zip, review_count, date_of_birth, occupation, gender, profile_pic, alternate_phone, marital_status, about) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                    db.query(insertQuery, insert_values, (error, results, fields) => {
                        if (err) {
                            console.log(err);
                        } else {
                            // var mailOptions = {
                            //     from: 'vivek@scwebtech.com',
                            //     to: req.body.email,
                            //     subject: 'Test Message From Bolo Grahak',
                            //     text: 'Test Message bidy'
                            // }
                            // mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
                            //     if (err) {
                            //         console.log(err);
                            //     } else {
                            //         console.log('Mail Send: ', info.response);
                            //     }
                            // })
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
exports.createCategory = async (req, res) => {
    //console.log('category', req.body);
    const { cat_name, cat_parent_id, country } = req.body;

    const catSlug = await new Promise((resolve, reject) => {
        comFunction2.generateUniqueSlugCategory(cat_name, (error, generatedSlug) => {
            if (error) {
                console.log('Error:', error.message);
                reject(error);
            } else {
                // console.log('Generated Company Slug:', generatedSlug);
                resolve(generatedSlug);
            }
        });
    });
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
                    const val = [cat_name, 0, req.file.filename, catSlug];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img, category_slug ) VALUES (?, ?, ?, ?)';
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
                    const val = [cat_name, cat_parent_id, req.file.filename, catSlug];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img, category_slug ) VALUES (?, ?, ?, ?)';
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
                    const val = [cat_name, 0, 'NULL', catSlug];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img, category_slug ) VALUES (?, ?, ?, ?)';
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
                    const val = [cat_name, cat_parent_id, 'NULL', catSlug];
                    const sql = 'INSERT INTO category (category_name, parent_id, category_img, category_slug ) VALUES (?, ?, ?, ?)';
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
    const { cat_id, cat_name, category_slug, cat_parent_id, country } = req.body;
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
                    const val = [cat_name, category_slug , req.file.filename, cat_id];
                    const sql = `UPDATE category SET category_name = ?, category_slug  = ?, category_img = ? WHERE ID = ?`;
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
                    const val = [cat_name, category_slug , cat_parent_id, req.file.filename, cat_id];

                    const sql = `UPDATE category SET category_name = ?,category_slug  = ?, parent_id = ?, category_img = ? WHERE ID = ?`;
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
                    const val = [cat_name, category_slug , cat_id];

                    const sql = `UPDATE category SET category_name = ?, category_slug =?  WHERE ID = ?`;
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
                    const val = [cat_name, category_slug, cat_parent_id, cat_id];

                    const sql = `UPDATE category SET category_name = ?,category_slug = ?, parent_id = ?  WHERE ID = ?`;
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
    console.log(req.body);
    const userId = req.body.user_id;

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
                const unlinkprofilePicture = "uploads/" + req.body.previous_profile_pic;
                fs.unlink(unlinkprofilePicture, (err) => {
                    if (err) {
                        //console.error('Error deleting file:', err);
                    } else {
                        //console.log('Previous file deleted');
                    }
                });
            }
            const userCustomerMetaUpdateData = {
                address: req.body.address || null,
                country: req.body.country || null,
                state: req.body.state || null,
                city: req.body.city || null,
                zip: req.body.zip || null,
                date_of_birth: req.body.date_of_birth || null,
                occupation: req.body.occupation || null,
                gender: req.body.gender || null,
                profile_pic: req.file ? req.file.filename : req.body.previous_profile_pic,
                alternate_phone: req.body.alternate_phone || null,
                marital_status: req.body.marital_status || null,
                about: req.body.about || null,
            };
            //const updateQueryMeta = 'UPDATE user_customer_meta SET address = ?, country = ?, state = ?, city = ?, zip = ?, date_of_birth = ?, occupation = ?, gender = ?, profile_pic = ?, alternate_phone = ?, about = ? WHERE user_id = ?';
            const updateQueryMeta = `UPDATE user_customer_meta SET ? WHERE user_id = ?`;

            db.query(updateQueryMeta, [userCustomerMetaUpdateData, userId], (updateError, updateResults) => {
                if (updateError) {
                    return res.send(
                        {
                            status: 'err',
                            data: userId,
                            message: 'An error occurred while processing your request' + updateError
                        }
                    )
                } else {
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



    });
}

//--- Delete User ----//
exports.deleteUser = (req, res) => {
    console.log(req.body);

    const userId = req.body.userid;
    const userEmail = req.body.userEmail;
    const deleteQueries = [
        `DELETE FROM user_code_verify WHERE user_id = '${userId}'`,
        `DELETE FROM users WHERE user_id = '${userId}'`,
        `DELETE FROM user_customer_meta WHERE user_id = ${userId}`,

        `DELETE bg_users, bg_usermeta
        FROM bg_users
        LEFT JOIN bg_usermeta ON bg_users.ID = bg_usermeta.user_id
        WHERE bg_users.user_login = '${userEmail}';
        `,

        `DELETE FROM user_device_info WHERE user_id = '${userId}'`,
        `DELETE discussions, discussions_user_response
        FROM discussions
        LEFT JOIN discussions_user_response ON discussions.id = discussions_user_response.discussion_id
        WHERE discussions.user_id = '${userId}';
        `,
        `DELETE complaint, complaint_rating,complaint_query_response
        FROM complaint
        LEFT JOIN complaint_rating ON complaint.id = complaint_rating.complaint_id
        LEFT JOIN complaint_query_response ON complaint.id = complaint_query_response.complaint_id                               
        WHERE complaint.user_id = '${userId}';
        `,
        `DELETE FROM poll_voting WHERE user_id = '${userId}'`,
        `DELETE reviews,review_reply,review_voting
        FROM reviews
        LEFT JOIN review_reply ON reviews.id = review_reply.review_id 
        LEFT JOIN review_voting ON reviews.id = review_voting.review_id                           
        WHERE reviews.customer_id = '${userId}';
        `,
        `DELETE FROM survey_customer_answers WHERE customer_id = '${userId}'`,
        `DELETE FROM company_claim_request WHERE claimed_by = '${userId}'`,
    ];

    const executeDeleteQuery = (index) => {
        if (index < deleteQueries.length) {
            const query = deleteQueries[index];
            db.query(query, (err, result) => {
                if (err) {
                    console.error('Query error:', err);

                    return res.send({
                        status: 'error',
                        message: `Failed to execute query: ${query}`,
                    });
                }

                // Continue with the next query
                executeDeleteQuery(index + 1);
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'User permanently deleted.',
            });
        }
    };

    executeDeleteQuery(0);
};


//--- Trash User ----//
exports.trashUser = (req, res) => {
    console.log(req.body.userid);
    sql = `UPDATE users SET user_status = '0' WHERE user_id = ?`;
    const data = [req.body.userid];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong' +err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'User successfully move to trash'
            });
        }
    })
}

//--- Restore User ----//
exports.restoreUser = (req, res) => {
    console.log(req.body.userid);
    sql = `UPDATE users SET user_status = '1' WHERE user_id = ?`;
    const data = [req.body.userid];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong' +err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'User successfully restore .'
            });
        }
    })
}

//--- Create New Company ----//
exports.createCompany = async (req, res) => {
    //console.log(req.body);
    const encodedUserData = req.cookies.user;
    const currentUserData = JSON.parse(encodedUserData);

    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // const [companySlug] = await Promise.all( [
    //     comFunction2.generateUniqueSlug(req.body.company_name)
    // ]);
    comFunction2.generateUniqueSlug(req.body.company_name, (error, companySlug) => {
        if (error) {
          console.log('Err: ', error.message);
        } else {
          console.log('companySlug', companySlug);
          var insert_values = [];
          if (req.file) {
              insert_values = [currentUserData.user_id, req.body.company_name, req.body.heading, req.file.filename, req.body.about_company, req.body.comp_phone, req.body.comp_email, req.body.comp_registration_id, req.body.status, req.body.trending, formattedDate, formattedDate, req.body.tollfree_number, req.body.main_address, req.body.main_address_pin_code, req.body.address_map_url, req.body.main_address_country, req.body.main_address_state, req.body.main_address_city, '0', 'free', companySlug];
          } else {
              insert_values = [currentUserData.user_id, req.body.company_name, req.body.heading, '', req.body.about_company, req.body.comp_phone, req.body.comp_email, req.body.comp_registration_id, req.body.status, req.body.trending, formattedDate, formattedDate, req.body.tollfree_number, req.body.main_address, req.body.main_address_pin_code, req.body.address_map_url, req.body.main_address_country, req.body.main_address_state, req.body.main_address_city, '0', 'free', companySlug];
          }
      
          const insertQuery = 'INSERT INTO company (user_created_by, company_name, heading, logo, about_company, comp_phone, comp_email, comp_registration_id, status, trending, created_date, updated_date, tollfree_number, main_address, main_address_pin_code, address_map_url, main_address_country, main_address_state, main_address_city, verified, paid_status, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
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
                  const categoryArray = Array.isArray(req.body.category) ? req.body.category : [req.body.category];
                  
                  // Filter out undefined values from categoryArray
                  const validCategoryArray = categoryArray.filter(categoryID => categoryID !== undefined);
      
                  console.log('categoryArray:', categoryArray);
                  if (validCategoryArray.length > 0) {
                      const companyCategoryData = validCategoryArray.map((categoryID) => [companyId, categoryID]);
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
                  }else{
                      return res.send(
                          {
                              status: 'ok',
                              data: companyId,
                              message: 'New company created without any category.'
                          }
                      )
                  }
              }
          })

        }
    });




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

    db.query(`SELECT slug FROM company WHERE slug = '${req.body.company_slug}' AND ID != '${companyID}' `, (slugErr, slugResult)=>{
        if (slugErr) {
            return res.send({
                status: 'err',
                data: '',
                message: 'An error occurred while updating the company details: ' + slugErr
            });
        }
        if(slugResult.length > 0) {
            return res.send({
                status: 'err',
                data: '',
                message: 'Company slug already exist'
            });
        } else {
                // Update company details in the company table
            const updateQuery = 'UPDATE company SET company_name = ?, heading = ?, logo = ?, about_company = ?, comp_phone = ?, comp_email = ?, comp_registration_id = ?, status = ?, trending = ?, updated_date = ?, tollfree_number = ?, main_address = ?, main_address_pin_code = ?, address_map_url = ?, main_address_country = ?, main_address_state = ?, main_address_city = ?, verified = ?, paid_status = ?, slug = ?, membership_type_id = ? WHERE ID = ?';
            const updateValues = [
                                    req.body.company_name,
                                    req.body.heading,
                                    '',
                                    req.body.about_company,
                                    req.body.comp_phone,
                                    req.body.comp_email,
                                    req.body.comp_registration_id,
                                    req.body.status,
                                    req.body.trending,
                                    formattedDate,
                                    req.body.tollfree_number,
                                    req.body.main_address,
                                    req.body.main_address_pin_code,
                                    req.body.address_map_url,
                                    req.body.main_address_country,
                                    req.body.main_address_state,
                                    req.body.main_address_city,
                                    req.body.verified,
                                    req.body.payment_status,
                                    req.body.company_slug,
                                    req.body.membership_type_id,
                                    companyID
                                ];

            if (req.file) {
                // Unlink (delete) the previous file
                const unlinkcompanylogo = "uploads/" + req.body.previous_logo;
                fs.unlink(unlinkcompanylogo, (err) => {
                    if (err) {
                        //console.error('Error deleting file:', err);
                    } else {
                        //console.log('Previous file deleted');
                    }
                });

                updateValues[2] = req.file.filename;
            }else{
                updateValues[2] = req.body.previous_logo;
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

                    if (req.body.category) {
                        // Create an array of arrays for bulk insert
                        const categoryArray = Array.isArray(req.body.category) ? req.body.category : [req.body.category];
                        const insertValues = categoryArray.map((categoryID) => [companyID, categoryID]);

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

                            // Insert claim request if req.body.claimed_by exists
                            if (req.body.claimed_by) {
                                const checkClaimRequestQuery = 'SELECT * FROM company_claim_request WHERE company_id = ?';
                                db.query(checkClaimRequestQuery, [companyID], async (err, claimRequestResults) => {
                                    if (err) {
                                        // Handle the error
                                        return res.send({
                                            status: 'err',
                                            data: '',
                                            message: 'An error occurred while checking company claim request: ' + err
                                        });
                                    }
                                    
                                    if (claimRequestResults.length > 0) {

                                        console.log('checkClaimRequestQuery',claimRequestResults)
                                        const ReviewReplyByQuery = 'UPDATE review_reply SET reply_by = ? WHERE company_id = ? AND reply_by = ?';
                                        const ReviewReplyByData = [req.body.claimed_by,companyID,claimRequestResults[0].claimed_by]
                                        db.query(ReviewReplyByQuery,ReviewReplyByData,(ReviewReplyByErr,ReviewReplyByResult)=>{
                                            const ReviewReplyToQuery = 'UPDATE review_reply SET reply_to = ? WHERE company_id = ? AND reply_to = ?';
                                            const ReviewReplyToData = [req.body.claimed_by,companyID,claimRequestResults[0].claimed_by]
                                            db.query(ReviewReplyToQuery,ReviewReplyToData,(ReviewReplyToErr,ReviewReplyToResult)=>{
                                                // Claim request already exists, handle accordingly
                                                const updateClaimRequestQuery = 'UPDATE company_claim_request SET claimed_by = ?, claimed_date = ? WHERE company_id = ?';
                                                const updateClaimRequestValues = [req.body.claimed_by, formattedDate, companyID];

                                                db.query(updateClaimRequestQuery, updateClaimRequestValues, (err) => {
                                                    if (err) {
                                                        // Handle the error
                                                        return res.send({
                                                            status: 'err',
                                                            data: '',
                                                            message: 'An error occurred while updating company claim request: ' + err
                                                        });
                                                    }

                                                    // Return success response
                                                    return res.send({
                                                        status: 'ok',
                                                        data: companyID,
                                                        message: 'Company details updated successfully'
                                                    });
                                                });
                                            })
                                        })
                                        
                                        
                                    }else{
                                        const claimRequestQuery = 'INSERT INTO company_claim_request (company_id, claimed_by, status, claimed_date) VALUES (?, ?, ?, ?)';
                                        const claimRequestValues = [companyID, req.body.claimed_by, '1', formattedDate];
                    
                                        db.query(claimRequestQuery, claimRequestValues, (err) => {
                                            if (err) {
                                                // Handle the error
                                                return res.send({
                                                    status: 'err',
                                                    data: '',
                                                    message: 'An error occurred while inserting company claim request: ' + err
                                                });
                                            }
                    
                                            // Return success response
                                            return res.send({
                                                status: 'ok',
                                                data: companyID,
                                                message: 'Company details updated successfully'
                                            });
                                        });
                                    }
                                });
                            } else {
                                // Return success response
                                return res.send({
                                    status: 'ok',
                                    data: companyID,
                                    message: 'Company details updated successfully'
                                });
                            }
                        })
                    }else{
                        // Insert claim request if req.body.claimed_by exists
                        if (req.body.claimed_by) {
                            const checkClaimRequestQuery = 'SELECT * FROM company_claim_request WHERE company_id = ?';
                            db.query(checkClaimRequestQuery, [companyID], (err, claimRequestResults) => {
                                if (err) {
                                    // Handle the error
                                    return res.send({
                                        status: 'err',
                                        data: '',
                                        message: 'An error occurred while checking company claim request: ' + err
                                    });
                                }
                                
                                if (claimRequestResults.length > 0) {

                                    console.log('checkClaimRequestQuery',claimRequestResults)
                                    const ReviewReplyByQuery = 'UPDATE review_reply SET reply_by = ? WHERE company_id = ? AND reply_by = ?';
                                    const ReviewReplyByData = [req.body.claimed_by,companyID,claimRequestResults[0].claimed_by]
                                        db.query(ReviewReplyByQuery,ReviewReplyByData,(ReviewReplyByErr,ReviewReplyByResult)=>{
                                        const ReviewReplyToQuery = 'UPDATE review_reply SET reply_to = ? WHERE company_id = ? AND reply_to = ?';
                                        const ReviewReplyToData = [req.body.claimed_by,companyID,claimRequestResults[0].claimed_by]
                                        db.query(ReviewReplyToQuery,ReviewReplyToData,(ReviewReplyToErr,ReviewReplyToResult)=>{
                                            // Claim request already exists, handle accordingly
                                            const updateClaimRequestQuery = 'UPDATE company_claim_request SET claimed_by = ?, claimed_date = ? WHERE company_id = ?';
                                            const updateClaimRequestValues = [req.body.claimed_by, formattedDate, companyID];

                                            db.query(updateClaimRequestQuery, updateClaimRequestValues, (err) => {
                                                if (err) {
                                                    // Handle the error
                                                    return res.send({
                                                        status: 'err',
                                                        data: '',
                                                        message: 'An error occurred while updating company claim request: ' + err
                                                    });
                                                }

                                                // Return success response
                                                return res.send({
                                                    status: 'ok',
                                                    data: companyID,
                                                    message: 'Company details updated successfully'
                                                });
                                            });
                                        })
                                    })
                                    
                                }else{
                                    const claimRequestQuery = 'INSERT INTO company_claim_request (company_id, claimed_by, status, claimed_date) VALUES (?, ?, ?, ?)';
                                    const claimRequestValues = [companyID, req.body.claimed_by, '1', formattedDate];
                
                                    db.query(claimRequestQuery, claimRequestValues, (err) => {
                                        if (err) {
                                            // Handle the error
                                            return res.send({
                                                status: 'err',
                                                data: '',
                                                message: 'An error occurred while inserting company claim request: ' + err
                                            });
                                        }
                
                                        // Return success response
                                        return res.send({
                                            status: 'ok',
                                            data: companyID,
                                            message: 'Company details updated successfully'
                                        });
                                    });
                                }
                            });
                        } else {
                            // Return success response
                            return res.send({
                                status: 'ok',
                                data: companyID,
                                message: 'Company details updated successfully'
                            });
                        } 
                    }
                })
            })
        }
    })
}

//--- Create Company Bulk Upload ----//
exports.companyBulkUpload = async (req, res) => {
    //console.log(req.body);
    if (!req.file) {
        return res.send(
            {
                status: 'err',
                data: '',
                message: 'No file uploaded.'
            }
        )        
    }
    const encodedUserData = req.cookies.user;
    const currentUserData = JSON.parse(encodedUserData);

    const csvFilePath = path.join(__dirname, '..', 'company-csv', req.file.filename);
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    
    // Process the uploaded CSV file and insert data into the database
    try {   
        const connection = await mysql.createConnection(dbConfig);

        const workbook = new ExcelJS.Workbook();
        await workbook.csv.readFile(csvFilePath);

        const worksheet = workbook.getWorksheet(1);
        const companies = await processCompanyCSVRows(worksheet, formattedDate, connection, currentUserData.user_id);
        //console.log('companies',companies);
        for (const company of companies) {
            //console.log('company:',company)
            try {

                const companySlug = await new Promise((resolve, reject) => {
                    comFunction2.generateUniqueSlug(company[1], (error, generatedSlug) => {
                        if (error) {
                            console.log('Error:', error.message);
                            reject(error);
                        } else {
                            // console.log('Generated Company Slug:', generatedSlug);
                            resolve(generatedSlug);
                        }
                    });
                });
                await company.push(companySlug);
                // Replace any undefined values with null
                const cleanedCompany = company.map(value => (value !== undefined ? value : null));
                //console.log(value);
                //return false;
                
                if (cleanedCompany[2] === null) {
                    cleanedCompany[2] = '';
                }
                if (cleanedCompany[3] === null) {
                    cleanedCompany[3] = '';
                }
                if (cleanedCompany[4] === null) {
                    cleanedCompany[4] = '';
                }
                if (cleanedCompany[5] === null) {
                    cleanedCompany[5] = '';
                }
                if (cleanedCompany[6] === null) {
                    cleanedCompany[6] = '';
                }
                if (cleanedCompany[7] === null) {
                    cleanedCompany[7] = '';
                }
                if (cleanedCompany[8] === null) {
                    cleanedCompany[8] = '';
                }
                if (cleanedCompany[9] === null) {
                    cleanedCompany[9] = '';
                }
                if (cleanedCompany[10] === null) {
                    cleanedCompany[10] = '';
                }
                if (cleanedCompany[11] === null) {
                    cleanedCompany[11] = '';
                }
                if (cleanedCompany[12] === null) {
                    cleanedCompany[12] = '';
                }
                if (cleanedCompany[13] === null) {
                    cleanedCompany[13] = '';
                }
                
                await connection.execute(
                    `
                    INSERT INTO company 
                        (user_created_by, company_name, heading, about_company, comp_email, comp_phone, tollfree_number, main_address, main_address_pin_code, address_map_url, comp_registration_id, status, trending, created_date, updated_date, main_address_country, main_address_state, main_address_city, verified, slug) 
                    VALUES 
                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE
                        user_created_by = VALUES(user_created_by),
                        company_name = VALUES(company_name), 
                        heading = VALUES(heading), 
                        about_company = VALUES(about_company),
                        comp_email = VALUES(comp_email),
                        comp_phone = VALUES(comp_phone),
                        tollfree_number = VALUES(tollfree_number),
                        main_address = VALUES(main_address),
                        main_address_pin_code = VALUES(main_address_pin_code),
                        address_map_url = VALUES(address_map_url),
                        comp_registration_id = VALUES(comp_registration_id),
                        status = VALUES(status),
                        trending = VALUES(trending),
                        created_date = VALUES(created_date),
                        updated_date =  VALUES(updated_date),
                        main_address_country =  VALUES(main_address_country),
                        main_address_state =  VALUES(main_address_state),
                        main_address_city =  VALUES(main_address_city),
                        verified =  VALUES(verified),
                        slug =  VALUES(slug)
                    `,
                    cleanedCompany
                );
            } catch (error) {
                console.error('Error:', error);
                return res.send({
                    status: 'err',
                    data: companies,
                    message: error.message
                });
            }
        }
        await connection.end(); // Close the connectio
        return res.send(
            {
                status: 'ok',
                data: companies,
                message: 'File uploaded.'
            }
        )  
        
    } catch (error) {
        console.error('Error:', error);
        return res.send({
            status: 'err',
            data: [],
            message: error.message
        });
    } finally {
        // Delete the uploaded CSV file
        //fs.unlinkSync(csvFilePath);
    }
}

// Define a promise-based function for processing rows
function processCompanyCSVRows(worksheet, formattedDate, connection, user_id) {
    return new Promise(async (resolve, reject) => {
        const companies = [];

        await worksheet.eachRow(async (row, rowNumber) => {
            if (rowNumber !== 1) { // Skip the header row
                
                companies.push([user_id, row.values[1], row.values[2], row.values[3], row.values[4], row.values[5], row.values[6], row.values[7], row.values[8], row.values[9], row.values[10], '1', '0', formattedDate, formattedDate, row.values[11], row.values[12], row.values[13], '0']);

            }
        });

        // Resolve the promise after all rows have been processed
        resolve(companies);
    });
}
// processCompanyCSVRows(worksheet, formattedDate, connection, user_id)
//     .then(companies => {
//         console.log('Resolved companies', companies);
//     })
//     .catch(error => {
//         console.error('Error:', error.message);
//     });

//--- Delete Company ----//
exports.deleteCompany = (req, res) => {
    //console.log(req.body.companyid);
    sql = `DELETE FROM company WHERE ID = ?`;
    const data = [req.body.companyid];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Company successfully deleted'
            });
        }

    })

}

//--- Delete Company ----//
exports.deletePayment = (req, res) => {
    //console.log(req.body.companyid);
    sql = `DELETE FROM payments WHERE id = ?`;
    const data = [req.body.paymentId];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Payment details successfully deleted'
            });
        }

    })

}

//--- Trash Company ----//
exports.trashCompany = (req, res) => {
    //console.log(req.body.companyid);
    sql = `UPDATE company SET status = '3' WHERE ID = ?`;
    const data = [req.body.companyid];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Company successfully move to trash'
            });
        }
    })
}

//--- Restore Company ----//
exports.restoreCompany = (req, res) => {
    //console.log(req.body.companyid);
    sql = `UPDATE company SET status = '2' WHERE ID = ?`;
    const data = [req.body.companyid];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Company successfully restored with pending status'
            });
        }
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

        insert_values = [req.body.review_rating_value, req.body.review_rating_name, req.file.filename, formattedRatingTags];
        var insert_values = [];
        if (req.file) {
            insert_values = [req.body.review_rating_value, req.body.review_rating_name, req.file.filename, formattedRatingTags];
        } else {
            insert_values = [req.body.review_rating_value, req.body.review_rating_name, '', formattedRatingTags];
        }

        const insertQuery = 'INSERT INTO review_rating_tags (review_rating_value, review_rating_name, rating_image, rating_tags) VALUES (?, ?, ?, ?)';
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
    const updateQuery = 'UPDATE review_rating_tags SET review_rating_name = ?, rating_image = ?, rating_tags = ? WHERE id = ?';

    var updateValues = [];
    if (req.file) {
        // Unlink (delete) the previous file
        const unlinkcompanylogo = "uploads/" + req.body.previous_rating_image;
        fs.unlink(unlinkcompanylogo, (err) => {
            if (err) {
                //console.error('Error deleting file:', err);
            } else {
                //console.log('Previous file deleted');
            }
        });
        updateValues = [req.body.review_rating_name, req.file.filename, formattedRatingTags, row_id];
    } else {
        updateValues = [req.body.review_rating_name, req.body.previous_rating_image, formattedRatingTags, row_id];
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

exports.editCustomerReview = async (req, res) => {
    //console.log('controller',req.body);
    //return false;
    // const ratingTagsArray = JSON.parse(req.body.rating_tags);
    // console.log(ratingTagsArray);
    //const editResponse1 = await comFunction.editCustomerReview( req.body );
    const [editResponse, ApproveMailSend,RejectdEmailSend ] = await Promise.all([
        comFunction.editCustomerReview( req.body ),
        comFunction2.reviewApprovedEmail(req.body),
        comFunction2.reviewRejectdEmail(req.body),
    ]);

    if(editResponse == true){
        // Return success response
        return res.send({
            status: 'ok',
            data: '',
            message: 'Review updated successfully'
        });
    }else{
        return res.send({
            status: 'err',
            data: '',
            message: editResponse
        });        
    }
}

exports.editCustomerReviewReply = async (req, res) => {
    console.log('editCustomerReviewReply',req.body);
    //return false;
    // const ratingTagsArray = JSON.parse(req.body.rating_tags);
    // console.log(ratingTagsArray);
    //const editResponse1 = await comFunction.editCustomerReview( req.body );
    const [ CustomerReply] = await Promise.all([
        comFunction2.updateCustomerReply(req.body),
    ]);

    if(CustomerReply == true){
        // Return success response
        return res.send({
            status: 'ok',
            data: '',
            message: 'Review reply updated successfully'
        });
    }else{
        return res.send({
            status: 'err',
            data: '',
            message: editResponse
        });        
    }
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
    const encodedUserData = req.cookies.user;
    const currentUserData = JSON.parse(encodedUserData);
    const fullname = currentUserData.first_name + " " +  currentUserData.last_name;
    const email = currentUserData.email;
    console.log(currentUserData.first_name, currentUserData.last_name, currentUserData.email);
    var mailOptions = {
        from: process.env.MAIL_USER,
        to: process.env.MAIL_SUPPORT,
        //to: 'pranab@scwebtech.com',
        subject: 'Feedback Mail From Contact',
        //html: ejs.renderFile(path.join(process.env.BASE_URL, '/views/email-template/', 'feedback.ejs'), { phone: phone, message: message })
        html: `<div id="wrapper" dir="ltr" style="background-color: #f5f5f5; margin: 0; padding: 70px 0 70px 0; -webkit-text-size-adjust: none !important; width: 100%;">
        <table height="100%" border="0" cellpadding="0" cellspacing="0" width="100%">
         <tbody>
          <tr>
           <td align="center" valign="top">
             <div id="template_header_image"><p style="margin-top: 0;"></p></div>
             <table id="template_container" style="box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; background-color: #fdfdf0; border: 1px solid #dcdcdc; border-radius: 3px !important;" border="0" cellpadding="0" cellspacing="0" width="600">
              <tbody>
                <tr>
                 <td align="center" valign="top">
                   <!-- Header -->
                   <table id="template_header" style="background-color: #000; border-radius: 3px 3px 0 0 !important; color: #ffc107; border-bottom: 0; font-weight: bold; line-height: 100%; vertical-align: middle; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif;" border="0" cellpadding="0" cellspacing="0" width="600">
                     <tbody>
                       <tr>
                <td id="header_wrapper" style="padding: 36px 48px; display: block;">
                           <h1 style="color: #ffc107; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 50px; font-weight: 400; line-height: 150%; margin: 0; text-align: left; text-shadow: 0 1px 0 #7797b4; -webkit-font-smoothing: antialiased;">Feedback Email</h1>
                        </td>
                       </tr>
                     </tbody>
                   </table>
             <!-- End Header -->
             </td>
                </tr>
                <tr>
                 <td align="center" valign="top">
                   <!-- Body -->
                   <table id="template_body" border="0" cellpadding="0" cellspacing="0" width="600">
                     <tbody>
                       <tr>
                        <td id="body_content" style="background-color: #fdfdfd;" valign="top">
                          <!-- Content -->
                          <table border="0" cellpadding="20" cellspacing="0" width="100%">
                           <tbody>
                            <tr>
                             <td style="padding: 48px;" valign="top">
                               <div id="body_content_inner" style="color: #737373; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 14px; line-height: 150%; text-align: left;">
                                
                                <table border="0" cellpadding="4" cellspacing="0" width="90%">
                                  <tr>
                                    <td colspan="2"><strong>Contact Info</strong></td>
                                  </tr>
                                  <tr>
                                    <td style="width:35%;">&nbsp;</td>
                                    <td>&nbsp;</td>
                                  </tr>
                                  <tr>
                                    <td style="width:35%;">Name:</td>
                                    <td>${fullname}</td>
                                  </tr>
                                  <tr>
                                    <td style="width:35%;">Email Address:</td>
                                    <td>${email}</td>
                                  </tr>
                                  <tr>
                                    <td style="width:35%;">Phone Number:</td>
                                    <td>${phone}</td>
                                  </tr>
                                  <tr>
                                    <td style="width:35%;">Message:</td>
                                    <td>${message}</td>
                                  </tr>
                                </table>
                                
                               </div>
                             </td>
                            </tr>
                           </tbody>
                          </table>
                        <!-- End Content -->
                        </td>
                       </tr>
                     </tbody>
                   </table>
                 <!-- End Body -->
                 </td>
                </tr>
                <tr>
                 <td align="center" valign="top">
                   <!-- Footer -->
                   <table id="template_footer" border="0" cellpadding="10" cellspacing="0" width="600">
                    <tbody>
                     <tr>
                      <td style="padding: 0; -webkit-border-radius: 6px;" valign="top">
                       <table border="0" cellpadding="10" cellspacing="0" width="100%">
                         <tbody>
                            <tr>
                            <td colspan="2" id="credit" style="padding: 20px 10px 20px 10px; -webkit-border-radius: 0px; border: 0; color: #fff; font-family: Arial; font-size: 12px; line-height: 125%; text-align: center; background:#000" valign="middle">
                                <p>This email was sent from <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a></p>
                            </td>
                            </tr>
                         </tbody>
                       </table>
                      </td>
                     </tr>
                    </tbody>
                   </table>
                 <!-- End Footer -->
                 </td>
                </tr>
              </tbody>
             </table>
           </td>
          </tr>
         </tbody>
        </table>
       </div>`
    }
    mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
            return res.send({
                status: 'not ok',
                message: 'Something went wrong'
            });
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
exports.createFAQ = async (req, res) => {
    //console.log(req.body);
    const faqArray = req.body.FAQ;
    //console.log(faqArray[0]);  
    //console.log(faqArray[1]);

    const Faq_Page_insert_values = [
        req.body.title,
        req.body.content,
        req.body.meta_title,
        req.body.meta_desc,
        req.body.keyword,
    ];
    try {
        const faqPageId = await comFunction.insertIntoFaqPages(Faq_Page_insert_values);
        console.log('ID:', faqPageId);
        await comFunction.insertIntoFaqCategories(faqArray);
        return res.send(
            {
                status: 'ok',
                data: faqPageId,
                message: 'FAQ Content successfully added'
            }
        )
    } catch (error) {
        console.error('Error during insertion:', error);
        return res.status(500).send({
            status: 'error',
            message: 'An error occurred while inserting FAQ data',
        });
    }
}

// Update FAQ
exports.updateFAQ = async (req, res) => {
    //console.log(req.body);
    const faqArray = req.body.FAQ;
    //console.log(faqArray[0]); 

    const Faq_Page_insert_values = [
        req.body.title,
        req.body.content,
        req.body.meta_title,
        req.body.meta_desc,
        req.body.keyword,
        req.body.app_content,
    ];
    try {
        db.query('DELETE  FROM faq_categories', (del_faq_cat_err, del_faq_cat_res) => {
            db.query('DELETE  FROM faq_item', async (del_faq_item_err, del_faq_item_res) => {
                const faqPageId = await comFunction.insertIntoFaqPages(Faq_Page_insert_values);
                console.log('ID:', faqPageId);
                await comFunction.insertIntoFaqCategories(faqArray);
                return res.send(
                    {
                        status: 'ok',
                        data: faqPageId,
                        message: 'FAQ Content successfully Updated'
                    }
                )
            })
        });



    } catch (error) {
        console.error('Error during insertion:', error);
        return res.status(500).send({
            status: 'error',
            message: 'An error occurred while inserting FAQ data',
        });
    }
}

//Update FAQ Images
exports.updateFAQImages =async (req,res) => {
    //console.log('files',req.files);
    const {banner_img_1,banner_img_2,banner_img_3,banner_img_4,banner_img_5,banner_img_6,banner_img_7,banner_img_8,app_banner_img} = req.files;
    // const img_arr = [banner_img_1,banner_img_2,banner_img_3,banner_img_4,banner_img_5,banner_img_6,banner_img_7,banner_img_8];
    const field_name = ['banner_img_1','banner_img_2','banner_img_3','banner_img_4','banner_img_5','banner_img_6','banner_img_7','banner_img_8','app_banner_img'];
    await field_name.forEach((item, key) => {
        //console.log(item, key);
        if (req.files[item]) {
             const sql = `UPDATE faq_pages SET ${item} = '${req.files[item][0].filename}' WHERE id = '1' `;
             db.query(sql, (err, result)=>{
                if(err) throw err;
                //console.log(result);
             })
        }
    })
    res.redirect('/edit-faq');

}
// Update Home
exports.updateHome = async (req, res) => {
    //  console.log('home', req.body);
    //     console.log('file', req.files);
    //return false;
    const form_data = req.body;

    const { home_id, title, meta_title, meta_desc, meta_keyword, bannner_content, for_business,
        for_customer, cus_right_content, cus_right_button_link, cus_right_button_text,youtube_link,
        youtube_1, youtube_2, youtube_3, youtube_4, youtube_5, youtube_6, youtube_7, youtube_8, youtube_9, youtube_10, fb_widget, twitter_widget,
        org_responsibility_content, org_responsibility_buttton_link, org_responsibility_buttton_text,
        about_us_content, about_us_button_link, about_us_button_text, bannner_content_2, bannner_hashtag, impression_number, impression_number_visibility, reviews_count, reviews_count_visibility, total_users_count, total_users_count_visibility, reviewers_guidelines_title,reviewers_guidelines_popup, review_form_demo_location, cus_right_facts_popup, org_responsibility_facts_popup, app_banner_title_1, app_banner_title_2, app_features_for_customer, app_review_content, app_features_hashtag, app_cus_right_content, app_cus_right_point, app_org_responsibility_content, app_org_responsibility_points, app_about_us_content_1, app_about_us_content_2, app_about_us_button_text, bannner_message } = req.body;

    const { banner_img_1, banner_img_2, banner_img_3,banner_img_4, banner_img_5, banner_img_6, cus_right_img_1, cus_right_img_2, cus_right_img_3, cus_right_img_4, cus_right_img_5,
        cus_right_img_6, cus_right_img_7, cus_right_img_8, org_responsibility_img_1, org_responsibility_img_2, org_responsibility_img_3,
        org_responsibility_img_4, org_responsibility_img_5, org_responsibility_img_6, org_responsibility_img_7, org_responsibility_img_8,
        about_us_img, review_img_1, review_img_2, review_img_3, review_img_4, map_img, app_cus_right_img, app_org_responsibility_img } = req.files;
    
    let app_features = [];
    if(typeof app_features_for_customer == 'string'){
        app_features.push(app_features_for_customer) ;
    } else {
        app_features = [...app_features_for_customer];
        //app_features = app_features.concat(app_features_for_customer);
    }
    const app_customer_feature = JSON.stringify(app_features);

    let app_hashtag = [];
    if(typeof app_features_hashtag == 'string'){
        app_hashtag.push(app_features_hashtag) ;
    } else {
        app_hashtag = [...app_features_hashtag];
    }
    const app_feature_hashtag = JSON.stringify(app_hashtag); 

    let cus_right_point = [];
    if(typeof app_cus_right_point == 'string'){
        cus_right_point.push(app_cus_right_point) ;
    } else {
        cus_right_point = [...app_cus_right_point];
    }
    const app_cus_right_points = JSON.stringify(cus_right_point); 

    let org_responsibility_point = [];
    if(typeof app_org_responsibility_points == 'string'){
        org_responsibility_point.push(app_org_responsibility_points) ;
    } else {
        org_responsibility_point = [...app_org_responsibility_points];
    }
    const app_org_responsibility_point = JSON.stringify(org_responsibility_point); 

    const meta_value = [bannner_content, for_business,
        for_customer, cus_right_content, cus_right_button_link, cus_right_button_text,youtube_link,
        youtube_1, youtube_2, youtube_3, youtube_4, fb_widget, twitter_widget,
        org_responsibility_content, org_responsibility_buttton_link, org_responsibility_buttton_text,
        about_us_content, about_us_button_link, about_us_button_text, bannner_content_2, bannner_hashtag, impression_number, impression_number_visibility, reviews_count, reviews_count_visibility, total_users_count, total_users_count_visibility, reviewers_guidelines_title, reviewers_guidelines_popup, review_form_demo_location, cus_right_facts_popup, org_responsibility_facts_popup,youtube_5, youtube_6, youtube_7, youtube_8, youtube_9, youtube_10, app_banner_title_1, app_banner_title_2, app_review_content, app_customer_feature,app_feature_hashtag, app_cus_right_content, app_cus_right_points, app_org_responsibility_content, app_org_responsibility_point, app_about_us_content_1, app_about_us_content_2, app_about_us_button_text, bannner_message];

    const meta_key = ['bannner_content', 'for_business',
        'for_customer', 'cus_right_content', 'cus_right_button_link', 'cus_right_button_text','youtube_link', 'youtube_1', 'youtube_2', 'youtube_3', 'youtube_4', 'fb_widget', 'twitter_widget',
        'org_responsibility_content', 'org_responsibility_buttton_link', 'org_responsibility_buttton_text',
        'about_us_content', 'about_us_button_link', 'about_us_button_text', 'bannner_content_2', 'bannner_hashtag', 'impression_number', 'impression_number_visibility', 'reviews_count', 'reviews_count_visibility', 'total_users_count', 'total_users_count_visibility', 'reviewers_guidelines_title','reviewers_guidelines_popup', 'review_form_demo_location', 'cus_right_facts_popup', 'org_responsibility_facts_popup','youtube_5', 'youtube_6', 'youtube_7', 'youtube_8', 'youtube_9', 'youtube_10','app_banner_title_1', 'app_banner_title_2', 'app_review_content', 'app_customer_feature','app_feature_hashtag', 'app_cus_right_content', 'app_cus_right_points', 'app_org_responsibility_content', 'app_org_responsibility_point', 'app_about_us_content_1', 'app_about_us_content_2', 'app_about_us_button_text', 'bannner_message'];

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

    const file_meta_value = [banner_img_1, banner_img_2, banner_img_3,banner_img_4, banner_img_5, banner_img_6, cus_right_img_1, cus_right_img_2, cus_right_img_3, cus_right_img_4, cus_right_img_5,
        cus_right_img_6, cus_right_img_7, cus_right_img_8, org_responsibility_img_1, org_responsibility_img_2, org_responsibility_img_3,
        org_responsibility_img_4, org_responsibility_img_5, org_responsibility_img_6, org_responsibility_img_7, org_responsibility_img_8,
        about_us_img, review_img_1, review_img_2, review_img_3, review_img_4, map_img, app_cus_right_img, app_org_responsibility_img ];

    const file_meta_key = ['banner_img_1', 'banner_img_2', 'banner_img_3','banner_img_4', 'banner_img_5', 'banner_img_6', 'cus_right_img_1', 'cus_right_img_2', 'cus_right_img_3', 'cus_right_img_4', 'cus_right_img_5',
        'cus_right_img_6', 'cus_right_img_7', 'cus_right_img_8', 'org_responsibility_img_1', 'org_responsibility_img_2', 'org_responsibility_img_3',
        'org_responsibility_img_4', 'org_responsibility_img_5', 'org_responsibility_img_6', 'org_responsibility_img_7', 'org_responsibility_img_8',
        'about_us_img', 'review_img_1', 'review_img_2', 'review_img_3', 'review_img_4', 'map_img' , 'app_cus_right_img', 'app_org_responsibility_img'];

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
    //console.log(title_data);
    db.query(title_sql, title_data, (title_err, title_result) => {
        return res.send(
            {
                status: 'ok',
                data: '',
                message: ' Updated successfully'
            }
        )
    })
}


//--Submit Review----//

exports.submitReview = async (req, res) => {
    const encodedUserData = req.cookies.user;
    console.log('submitReview',req.body);
    //return false;
    try {
        if (encodedUserData) {
            const currentUserData = JSON.parse(encodedUserData);
            //console.log(currentUserData);
            const userId = currentUserData.user_id;
            const company = await comFunction.createCompany(req.body, userId);
            console.log('companyInfo',company)
            const review = await comFunction.createReview(req.body, userId, company);
            // Render the 'edit-user' EJS view and pass the data
            if(company && review){
                console.log('submit review:',review)
                const template = `<div id="wrapper" dir="ltr" style="background-color: #f5f5f5; margin: 0; padding: 70px 0 70px 0; -webkit-text-size-adjust: none !important; width: 100%;">
                <table height="100%" border="0" cellpadding="0" cellspacing="0" width="100%">
                 <tbody>
                  <tr>
                   <td align="center" valign="top">
                     <div id="template_header_image"><p style="margin-top: 0;"></p></div>
                     <table id="template_container" style="box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; background-color: #fdfdfd; border: 1px solid #dcdcdc; border-radius: 3px !important;" border="0" cellpadding="0" cellspacing="0" width="600">
                      <tbody>
                        <tr>
                         <td align="center" valign="top">
                           <!-- Header -->
                           <table id="template_header" style="background-color: #000; border-radius: 3px 3px 0 0 !important; color: #ffffff; border-bottom: 0; font-weight: bold; line-height: 100%; vertical-align: middle; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif;" border="0" cellpadding="0" cellspacing="0" width="600">
                             <tbody>
                               <tr>
                               <td><img alt="Logo" src="${process.env.MAIN_URL}assets/media/logos/email-template-logo.png"  style="padding: 30px 40px; display: block;  width: 70px;" /></td>
                                <td id="header_wrapper" style="padding: 36px 48px; display: block;">
                                   <h1 style="color: #FCCB06; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 30px; font-weight: bold; line-height: 150%; margin: 0; text-align: left;">New Review</h1>
                                </td>
          
                               </tr>
                             </tbody>
                           </table>
                     <!-- End Header -->
                     </td>
                        </tr>
                        <tr>
                         <td align="center" valign="top">
                           <!-- Body -->
                           <table id="template_body" border="0" cellpadding="0" cellspacing="0" width="600">
                             <tbody>
                               <tr>
                                <td id="body_content" style="background-color: #fdfdfd;" valign="top">
                                  <!-- Content -->
                                  <table border="0" cellpadding="20" cellspacing="0" width="100%">
                                   <tbody>
                                    <tr>
                                     <td style="padding: 48px;" valign="top">
                                       <div id="body_content_inner" style="color: #737373; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 14px; line-height: 150%; text-align: left;">
                                        
                                        <table border="0" cellpadding="4" cellspacing="0" width="90%">
                                          <tr>
                                            <td colspan="2">
                                            <strong>Hello,</strong>
                                            <p style="font-size:15px; line-height:20px">A new review submitted. <a class="btn btn-primary" href="${process.env.MAIN_URL}edit-review/${review}">Click here </a>to check this review.</p>
                                            </td>
                                          </tr>
                                        </table>
                                        
                                       </div>
                                     </td>
                                    </tr>
                                   </tbody>
                                  </table>
                                <!-- End Content -->
                                </td>
                               </tr>
                             </tbody>
                           </table>
                         <!-- End Body -->
                         </td>
                        </tr>
                        <tr>
                         <td align="center" valign="top">
                           <!-- Footer -->
                           <table id="template_footer" border="0" cellpadding="10" cellspacing="0" width="600">
                            <tbody>
                             <tr>
                              <td style="padding: 0; -webkit-border-radius: 6px;" valign="top">
                               <table border="0" cellpadding="10" cellspacing="0" width="100%">
                                 <tbody>
                                   <tr>
                                    <td colspan="2" id="credit" style="padding: 20px 10px 20px 10px; -webkit-border-radius: 0px; border: 0; color: #fff; font-family: Arial; font-size: 12px; line-height: 125%; text-align: center; background:#000" valign="middle">
                                         <p>This email was sent from <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a></p>
                                    </td>
                                   </tr>
                                 </tbody>
                               </table>
                              </td>
                             </tr>
                            </tbody>
                           </table>
                         <!-- End Footer -->
                         </td>
                        </tr>
                      </tbody>
                     </table>
                   </td>
                  </tr>
                 </tbody>
                </table>
               </div>`;
                var mailOptions = {
                    from: process.env.MAIL_USER,
                    //to: 'pranab@scwebtech.com',
                    to: process.env.MAIL_USER,
                    subject: 'New review added',
                    html: template
                  }
              
                mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
                    if (err) {
                        console.log(err);
                        return res.send({
                            status: 'not ok',
                            message: 'Something went wrong'
                        });
                    } else {
                        console.log('Mail Send: ', info.response);
                        return res.send(
                        {
                            status: 'ok',
                            data: '',
                            message: 'Review Mail send successfully'
                        }
                    )
                    }
                })
                return res.send(
                    {
                        status: 'ok',
                        data:   '',
                        company,
                        message: 'Review successfully posted, please wait for admin approval'
                    }
                );
            }else{
                return res.send(
                    {
                        status: 'error',
                        data: {company,review},
                        message: 'Error occurred please try again'
                    }
                );
            }
        } else {
            //res.redirect('sign-in');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('An error occurred');
    }
}
//--Submit Review----//

exports.editUserReview = async (req, res) => {
    const encodedUserData = req.cookies.user;
    console.log(req.body);
    try {
        if (encodedUserData) {
            const currentUserData = JSON.parse(encodedUserData);
            //console.log(currentUserData);
            const userId = currentUserData.user_id;
            const review = await comFunction2.updateReview(req.body);

            const template = `<div id="wrapper" dir="ltr" style="background-color: #f5f5f5; margin: 0; padding: 70px 0 70px 0; -webkit-text-size-adjust: none !important; width: 100%;">
            <table height="100%" border="0" cellpadding="0" cellspacing="0" width="100%">
             <tbody>
              <tr>
               <td align="center" valign="top">
                 <div id="template_header_image"><p style="margin-top: 0;"></p></div>
                 <table id="template_container" style="box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; background-color: #fdfdfd; border: 1px solid #dcdcdc; border-radius: 3px !important;" border="0" cellpadding="0" cellspacing="0" width="600">
                  <tbody>
                    <tr>
                     <td align="center" valign="top">
                       <!-- Header -->
                       <table id="template_header" style="background-color: #000; border-radius: 3px 3px 0 0 !important; color: #ffffff; border-bottom: 0; font-weight: bold; line-height: 100%; vertical-align: middle; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif;" border="0" cellpadding="0" cellspacing="0" width="600">
                         <tbody>
                           <tr>
                           <td><img alt="Logo" src="${process.env.MAIN_URL}assets/media/logos/email-template-logo.png"  style="padding: 30px 40px; display: block;  width: 70px;" /></td>
                            <td id="header_wrapper" style="padding: 36px 48px; display: block;">
                               <h1 style="color: #FCCB06; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 30px; font-weight: bold; line-height: 150%; margin: 0; text-align: left;">User review update</h1>
                            </td>
      
                           </tr>
                         </tbody>
                       </table>
                 <!-- End Header -->
                 </td>
                    </tr>
                    <tr>
                     <td align="center" valign="top">
                       <!-- Body -->
                       <table id="template_body" border="0" cellpadding="0" cellspacing="0" width="600">
                         <tbody>
                           <tr>
                            <td id="body_content" style="background-color: #fdfdfd;" valign="top">
                              <!-- Content -->
                              <table border="0" cellpadding="20" cellspacing="0" width="100%">
                               <tbody>
                                <tr>
                                 <td style="padding: 48px;" valign="top">
                                   <div id="body_content_inner" style="color: #737373; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 14px; line-height: 150%; text-align: left;">
                                    
                                    <table border="0" cellpadding="4" cellspacing="0" width="90%">
                                      <tr>
                                        <td colspan="2">
                                        <strong>Hello,</strong>
                                        <p style="font-size:15px; line-height:20px">A new review submitted. <a class="btn btn-primary" href="${process.env.MAIN_URL}edit-review/${review}">Click here </a>to check this review.</p>
                                        </td>
                                      </tr>
                                    </table>
                                    
                                   </div>
                                 </td>
                                </tr>
                               </tbody>
                              </table>
                            <!-- End Content -->
                            </td>
                           </tr>
                         </tbody>
                       </table>
                     <!-- End Body -->
                     </td>
                    </tr>
                    <tr>
                     <td align="center" valign="top">
                       <!-- Footer -->
                       <table id="template_footer" border="0" cellpadding="10" cellspacing="0" width="600">
                        <tbody>
                         <tr>
                          <td style="padding: 0; -webkit-border-radius: 6px;" valign="top">
                           <table border="0" cellpadding="10" cellspacing="0" width="100%">
                             <tbody>
                               <tr>
                                <td colspan="2" id="credit" style="padding: 20px 10px 20px 10px; -webkit-border-radius: 0px; border: 0; color: #fff; font-family: Arial; font-size: 12px; line-height: 125%; text-align: center; background:#000" valign="middle">
                                     <p>This email was sent from <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a></p>
                                </td>
                               </tr>
                             </tbody>
                           </table>
                          </td>
                         </tr>
                        </tbody>
                       </table>
                     <!-- End Footer -->
                     </td>
                    </tr>
                  </tbody>
                 </table>
               </td>
              </tr>
             </tbody>
            </table>
           </div>`;
            var mailOptions = {
                from: process.env.MAIL_USER,
                //to: 'pranab@scwebtech.com',
                to: process.env.MAIL_USER,
                subject: 'User review update',
                html: template
              }
          
              await mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log(err);
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong'
                    });
                } else {
                    console.log('Mail Send: ', info.response);
                    
                }
            })

            return res.send(
                {
                    status: 'ok',
                    data:   '',
                    message: 'Review updated successfully please wait for admin approval'
                }
            );
            
        } 
    } catch (err) {
        console.error(err);
        res.status(500).send('An error occurred');
    }
}

//--- Delete Review ----//
exports.deleteReview = (req, res) => {
    //console.log(req.body.companyid);
    sql = `DELETE FROM reviews WHERE id = ?`;
    const data = [req.body.reviewid];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'error',
                message: 'Something went wrong'+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Review successfully deleted'
            });
        }

    })

}

// Upadte About
exports.updateAbout = async (req, res) => {
    // console.log('home', req.body);
    // console.log('file', req.files);
    const form_data = req.body;

    const { about_id, title, meta_title, meta_desc, meta_keyword, banner_content, mission_title,
        mission_content, platform_content, bolograhak_would_content, customers_content,
        service_providers_content, app_banner_content_1, app_banner_content_2, app_platform_content_1, app_platform_content_2 } = req.body;

    const { banner_img_1, banner_img_2, banner_img_3, banner_img_4, banner_img_5, banner_img_6, banner_img_7, banner_img_8,
        platform_img_1, platform_img_2, platform_img_3, platform_img_4, platform_img_5, platform_img_6, platform_img_7,
        platform_img_8, right_img_1, right_img_2, app_banner_img_1, app_banner_img_2 } = req.files;

    const meta_value = [banner_content, mission_title,
        mission_content, platform_content, bolograhak_would_content, customers_content,
        service_providers_content, app_banner_content_1, app_banner_content_2, app_platform_content_1, app_platform_content_2];

    const meta_key = ['banner_content', 'mission_title',
        'mission_content', 'platform_content', 'bolograhak_would_content', 'customers_content',
        'service_providers_content', 'app_banner_content_1', 'app_banner_content_2', 'app_platform_content_1', 'app_platform_content_2'];

    await meta_value.forEach((element, index) => {
        //console.log(element, index);
        const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
        const check_data = [about_id, meta_key[index]];
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
                    const update_data = [element, about_id, meta_key[index]];
                    db.query(update_sql, update_data, (update_err, update_result) => {
                        if (update_err) throw update_err;
                    })
                } else {
                    const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                    const insert_data = [about_id, meta_key[index], element];
                    db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                        if (insert_err) throw insert_err;
                    })
                }
            }
        });
    });

    const file_meta_value = [banner_img_1, banner_img_2, banner_img_3, banner_img_4, banner_img_5, banner_img_6, banner_img_7, banner_img_8,
        platform_img_1, platform_img_2, platform_img_3, platform_img_4, platform_img_5, platform_img_6, platform_img_7,
        platform_img_8, right_img_1, right_img_2, app_banner_img_1, app_banner_img_2];

    const file_meta_key = ['banner_img_1', 'banner_img_2', 'banner_img_3', 'banner_img_4', 'banner_img_5', 'banner_img_6', 'banner_img_7', 'banner_img_8',
        'platform_img_1', 'platform_img_2', 'platform_img_3', 'platform_img_4', 'platform_img_5', 'platform_img_6', 'platform_img_7',
        'platform_img_8', 'right_img_1', 'right_img_2', 'app_banner_img_1', 'app_banner_img_2'];

    await file_meta_key.forEach((item, key) => {
        //console.log(item, key);
        if (req.files[item]) {
            //console.log(file_meta_value[key][0].filename);
            const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
            const check_data = [about_id, item];
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
                        const update_data = [file_meta_value[key][0].filename, about_id, item];
                        db.query(update_sql, update_data, (update_err, update_result) => {
                            if (update_err) throw update_err;
                        })
                    } else {
                        const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                        const insert_data = [about_id, item, file_meta_value[key][0].filename];
                        db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                            if (insert_err) throw insert_err;
                        })
                    }
                }
            });
        }

    });

    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
    const title_data = [title, meta_title, meta_desc, meta_keyword, about_id];
    //console.log(title_data);
    db.query(title_sql, title_data, (title_err, title_result) => {
        return res.send(
            {
                status: 'ok',
                data: '',
                message: 'Updated successfully'
            }
        )
    })
}

// Create Featured Company
exports.creatFeaturedCompany = (req, res) => {
    const { featured_company_id, comp_short_desc, comp_url, status, order } = req.body;
    sql = `INSERT INTO featured_companies ( company_id, short_desc, link, status, ordering) VALUES (?,?,?,?,?)`;
    const data = [featured_company_id, comp_short_desc, comp_url, status, order];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Featured Company Created successfully'
            });
        }

    })
}

// Update Featured Company
exports.updateFeaturedCompany = (req, res) => {
    const { comp_id, comp_name, comp_short_desc, comp_url, status, order } = req.body;
    sql = `UPDATE featured_companies SET  short_desc = ?, link = ?, status = ?, ordering = ? WHERE id = ?`;
    const data = [comp_short_desc, comp_url, status, order, comp_id];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Featured Company Updated Successfully'
            });
        }

    })
}

// Delete Featured Company
exports.deleteFeaturedCompany = (req, res) => {
    // const { comp_id, comp_name, comp_short_desc, comp_url, status, order } = req.body;
    sql = `DELETE FROM featured_companies WHERE id = ?`;
    const data = [comp_short_desc, comp_url, status, order, comp_id];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong'
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Featured Company Updated Successfully'
            });
        }

    })
}

// Update Business
exports.updateBusiness = async (req, res) => {
    console.log('business', req.body);
    console.log('file', req.files);
    //return false;
    const { business_id, title, meta_title, meta_desc, meta_keyword, bannner_content, features_title,
        feature_content,feature_icon, advantage_title, advantage_content, dont_forget_title,
        dont_forget_content_1, dont_forget_content_2, did_you_know_title, did_you_know_content_1, did_you_know_content_2, upcoming_features_title, upcoming_features_content, bottom_content, app_bannner_content_title, app_bannner_content_1, app_bannner_content_2, app_advantage_point, app_dont_forget_content_1_title,app_dont_forget_content_1, app_dont_forget_content_2_title, app_dont_forget_content_2 } = req.body;

    const { banner_img_1, banner_img_2, banner_img_3, banner_img_4, banner_img_5, banner_img_6,banner_img_7, banner_img_8,  advantage_img_1, advantage_img_2, advantage_img_3, advantage_img_4, advantage_img_5, advantage_img_6, advantage_img_7, advantage_img_8, did_you_know_img, app_banner_img_1, app_banner_img_2 } = req.files;


    let advantage_point = [];
    if(typeof app_advantage_point == 'string'){
        advantage_point.push(app_advantage_point) ;
    } else {
        advantage_point = [...app_advantage_point];
    }
    const app_advantage_points = JSON.stringify(advantage_point); 

    const meta_value = [bannner_content, features_title, advantage_title, advantage_content, dont_forget_title,
        dont_forget_content_1, dont_forget_content_2, did_you_know_title, did_you_know_content_1, did_you_know_content_2, upcoming_features_title, bottom_content, app_bannner_content_title, app_bannner_content_1, app_bannner_content_2, app_dont_forget_content_1_title,app_dont_forget_content_1, app_dont_forget_content_2_title, app_dont_forget_content_2,app_advantage_points];

    const meta_key = ['bannner_content', 'features_title', 'advantage_title', 'advantage_content', 'dont_forget_title',
        'dont_forget_content_1', 'dont_forget_content_2', 'did_you_know_title', 'did_you_know_content_1', 'did_you_know_content_2', 'upcoming_features_title', 'bottom_content', 'app_bannner_content_title', 'app_bannner_content_1', 'app_bannner_content_2', 'app_dont_forget_content_1_title','app_dont_forget_content_1', 'app_dont_forget_content_2_title', 'app_dont_forget_content_2','app_advantage_points'];

    await meta_value.forEach((element, index) => {
        //console.log(element, index);
        const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
        const check_data = [business_id, meta_key[index]];
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
                    const update_data = [element, business_id, meta_key[index]];
                    db.query(update_sql, update_data, (update_err, update_result) => {
                        if (update_err) throw update_err;
                    })
                } else {
                    const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                    const insert_data = [business_id, meta_key[index], element];
                    db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                        if (insert_err) throw insert_err;
                    })
                }
            }
        });
    });

    const file_meta_value = [banner_img_1, banner_img_2, banner_img_3, banner_img_4, banner_img_5, banner_img_6,banner_img_7, banner_img_8, advantage_img_1, advantage_img_2, advantage_img_3, advantage_img_4, advantage_img_5,
        advantage_img_6, advantage_img_7, advantage_img_8, did_you_know_img,app_banner_img_1, app_banner_img_2];

    const file_meta_key = ['banner_img_1', 'banner_img_2', 'banner_img_3', 'banner_img_4', 'banner_img_5', 'banner_img_6','banner_img_7', 'banner_img_8', 'advantage_img_1', 'advantage_img_2', 'advantage_img_3', 'advantage_img_4', 'advantage_img_5', 'advantage_img_6', 'advantage_img_7', 'advantage_img_8', 'did_you_know_img','app_banner_img_1', 'app_banner_img_2'];

    await file_meta_key.forEach((item, key) => {
        //console.log(item, key);
        if (req.files[item]) {
            //console.log(file_meta_value[key][0].filename);
            const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
            const check_data = [business_id, item];
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
                        const update_data = [file_meta_value[key][0].filename, business_id, item];
                        db.query(update_sql, update_data, (update_err, update_result) => {
                            if (update_err) throw update_err;
                        })
                    } else {
                        const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                        const insert_data = [business_id, item, file_meta_value[key][0].filename];
                        db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                            if (insert_err) throw insert_err;
                        })
                    }
                }
            });
        }

    });
    await comFunction2.deleteBusinessFeature();
    await comFunction2.deleteBusinessUpcomingFeature();
    if (typeof feature_content === 'string' ) {
        const insert_query = `INSERT INTO business_features ( content, image, existing_or_upcoming) VALUES (?, ?,'existing')`;
        const insert_data = [feature_content, feature_icon];
        db.query(insert_query,insert_data,(insert_err,insert_res)=>{
            if (insert_err) {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request'
                    }
                )
            }
        });
        
    }else{
        await feature_content.forEach((value, key) => {
            const insert_query = `INSERT INTO business_features ( content, image, existing_or_upcoming) VALUES (?, ?,'existing')`;
            const insert_data = [value, feature_icon[key]];
            db.query(insert_query,insert_data,(insert_err,insert_res)=>{
                if (insert_err) {
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: 'An error occurred while processing your request'
                        }
                    )
                }
            });
        });
    }

if (typeof upcoming_features_content === 'string' ) {
    const insert_query = `INSERT INTO business_features ( content, existing_or_upcoming) VALUES (?,'upcoming')`;
    const insert_data = [upcoming_features_content];
     db.query(insert_query, insert_data, (insert_err,insert_res) => {
        if (insert_err) {
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request'
                }
            )
        }
    });
}else{
    await upcoming_features_content.forEach((value, key) => {
        const insert_query = `INSERT INTO business_features ( content, existing_or_upcoming) VALUES (?,'upcoming')`;
        const insert_data = [value];
         db.query(insert_query, insert_data, (insert_err,insert_res) => {
            if (insert_err) {
                return res.send(
                    {
                        status: 'err',
                        data: '',
                        message: 'An error occurred while processing your request'
                    }
                )
            }
        });
    })
}
    

    

    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
    const title_data = [title, meta_title, meta_desc, meta_keyword, business_id];
    //console.log(title_data);
    db.query(title_sql, title_data, (title_err, title_result) => {
        return res.send(
            {
                status: 'ok',
                data: '',
                message: 'Updated successfully'
            }
        )
    })
}

// Update Privacy Policy
exports.updatePrivacy = (req, res) => {
    //console.log('Privacy', req.body);

    const { common_id, title, meta_title, meta_desc, keyword, content } = req.body;

    const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
    const check_data = [common_id, "content"];
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
                const update_data = [content, common_id,'content'];
                db.query(update_sql, update_data, (update_err, update_result) => {
                    if (update_err) throw update_err;
                    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
                    const title_data = [title, meta_title, meta_desc, keyword, common_id];
                    //console.log(title_data);
                    db.query(title_sql, title_data, (title_err, title_result) => {
                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Privacy policy update successfully'
                            }
                        )
                    })
                })
            } else {
                const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                const insert_data = [common_id, 'content', content];
                db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                    if (insert_err) throw insert_err;
                    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
                    const title_data = [title, meta_title, meta_desc, keyword, common_id];
                    //console.log(title_data);
                    db.query(title_sql, title_data, (title_err, title_result) => {
                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Privacy policy updated successfully'
                            }
                        )
                    })
                })
            }
        }
    });

    
}

// Update Disclaimer
exports.updateDisclaimer = (req, res) => {
    //console.log('Privacy', req.body);

    const { common_id, title, meta_title, meta_desc, keyword, content } = req.body;

    const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
    const check_data = [common_id, "content"];
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
                const update_data = [content, common_id,'content'];
                db.query(update_sql, update_data, (update_err, update_result) => {
                    if (update_err) throw update_err;
                    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
                    const title_data = [title, meta_title, meta_desc, keyword, common_id];
                    //console.log(title_data);
                    db.query(title_sql, title_data, (title_err, title_result) => {
                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Disclaimer updated successfully'
                            }
                        )
                    })
                })
            } else {
                const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                const insert_data = [common_id, 'content', content];
                db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                    if (insert_err) throw insert_err;
                    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
                    const title_data = [title, meta_title, meta_desc, keyword, common_id];
                    //console.log(title_data);
                    db.query(title_sql, title_data, (title_err, title_result) => {
                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Disclaimer updated successfully'
                            }
                        )
                    })
                })
            }
        }
    });

    
}

// Update Terms Of Service
exports.updateTermsOfService = (req, res) => {
    //console.log('Privacy', req.body);

    const { common_id, title, meta_title, meta_desc, keyword, content } = req.body;

    const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
    const check_data = [common_id, "content"];
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
                const update_data = [content, common_id,'content'];
                db.query(update_sql, update_data, (update_err, update_result) => {
                    if (update_err) throw update_err;
                    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
                    const title_data = [title, meta_title, meta_desc, keyword, common_id];
                    //console.log(title_data);
                    db.query(title_sql, title_data, (title_err, title_result) => {
                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Terms Of Service updated successfully'
                            }
                        )
                    })
                })
            } else {
                const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                const insert_data = [common_id, 'content', content];
                db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                    if (insert_err) throw insert_err;
                    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
                    const title_data = [title, meta_title, meta_desc, keyword, common_id];
                    //console.log(title_data);
                    db.query(title_sql, title_data, (title_err, title_result) => {
                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Terms Of Service update successfully'
                            }
                        )
                    })
                })
            }
        }
    });

    
}
// Update complaint
exports.updateComplaint = async (req, res) => {
     //console.log('updateComplaint', req.body);
     //console.log('updateComplaint', req.files);
    const form_data = req.body;
    const { common_id, title, meta_title, meta_desc, meta_keyword } = req.body;
    const { banner_img_1, banner_img_2, banner_img_3, banner_img_4, banner_img_5, banner_img_6, banner_img_7, banner_img_8 } = req.files;
    const file_meta_value = [banner_img_1, banner_img_2, banner_img_3, banner_img_4, banner_img_5, banner_img_6, banner_img_7, banner_img_8];
    const file_meta_key = ['banner_img_1', 'banner_img_2', 'banner_img_3', 'banner_img_4', 'banner_img_5', 'banner_img_6', 'banner_img_7', 'banner_img_8'];
    await file_meta_key.forEach((item, key) => {
        //console.log(item, key);
        if (req.files[item]) {
            //console.log(file_meta_value[key][0].filename);
            const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
            const check_data = [common_id, item];
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
                        const update_data = [file_meta_value[key][0].filename, common_id, item];
                        db.query(update_sql, update_data, (update_err, update_result) => {
                            if (update_err) throw update_err;
                        })
                    } else {
                        const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                        const insert_data = [common_id, item, file_meta_value[key][0].filename];
                        db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                            if (insert_err) throw insert_err;
                        })
                    }
                }
            });
        }
    });
    const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
    const title_data = [title, meta_title, meta_desc, meta_keyword, common_id];
    //console.log(title_data);
    db.query(title_sql, title_data, (title_err, title_result) => {
        return res.send(
            {
                status: 'ok',
                data: '',
                message: 'Updated successfully'
            }
        )
    })
}
// Frontend Update Myprofile page
exports.updateMyProfile = (req, res) => {
    // console.log('edit profile', req.body)
    // console.log('profile pic', req.file)
    const userId = req.body.user_id;
    //const checkQuery = 'SELECT user_id FROM users WHERE phone = ? AND user_id <> ?';
    // Update the user's data
    const updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE user_id = ?';
    db.query(updateQuery, [req.body.first_name, req.body.last_name, req.body.phone,  userId], (updateError, updateResults) => {

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
                const unlinkprofilePicture = "uploads/" + req.body.previous_profile_pic;
                fs.unlink(unlinkprofilePicture, (err) => {
                    if (err) {
                        //console.error('Error deleting file:', err);
                    } else {
                        //console.log('Previous file deleted');
                    }
                });
                //const profilePicture = req.file;
                console.log(req.file.filename);
                

                const updateQueryMeta = 'UPDATE user_customer_meta SET address = ?, country = ?, state = ?, city = ?, zip = ?, date_of_birth = ?,  gender = ?, profile_pic = ?, alternate_phone = ?, marital_status = ?, about = ? WHERE user_id = ?';
                const updateQueryData = [req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, req.body.date_of_birth,  req.body.gender, req.file.filename, req.body.alternate_phone, req.body.marital_status, req.body.about, userId]
                db.query(updateQueryMeta, updateQueryData , (updateError, updateResults) => {
                    if (updateError) {
                        return res.send(
                            {
                                status: 'err',
                                data: userId,
                                message: 'An error occurred while processing your request' + updateError
                            }
                        )
                    } else {
                        const query = `
                                SELECT user_meta.*, c.name as country_name, s.name as state_name, u.first_name
                                , u.last_name, u.email, u.phone, u.user_type_id, ccr.company_id as claimed_comp_id
                                FROM user_customer_meta user_meta
                                LEFT JOIN users u ON u.user_id = user_meta.user_id
                                LEFT JOIN countries c ON user_meta.country = c.id
                                LEFT JOIN states s ON user_meta.state = s.id
                                LEFT JOIN company_claim_request ccr ON user_meta.user_id = ccr.claimed_by
                                WHERE user_meta.user_id = ?
                                `;
                            db.query(query, [userId], async (err, results) => {
                            let userData = {};
                            if (results.length > 0) {
                                const user_meta = results[0];
                                //console.log(user_meta,'aaaaaaaa');
                                // Set a cookie
                                const dateString = user_meta.date_of_birth;
                                const date_of_birth_date = new Date(dateString);
                                const formattedDate = date_of_birth_date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                                let userData = {
                                    user_id: user_meta.user_id,
                                    first_name: user_meta.first_name,
                                    last_name: user_meta.last_name,
                                    email: user_meta.email,
                                    phone: user_meta.phone,
                                    user_type_id: user_meta.user_type_id,
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
                                    profile_pic: user_meta.profile_pic,
                                    claimed_comp_id: user_meta.claimed_comp_id
                                };
                                const encodedUserData = JSON.stringify(userData);
                                res.cookie('user', encodedUserData);
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: userId,
                                        message: 'Successfully Updated'
                                    }
                                )
                            } 
                        });

                        
                    }
                });

            } else {
                const updateQueryMeta = 'UPDATE user_customer_meta SET address = ?, country = ?, state = ?, city = ?, zip = ?, date_of_birth = ?, gender = ?, alternate_phone = ?, marital_status = ?, about = ? WHERE user_id = ?';
                const updateQueryData = [req.body.address, req.body.country, req.body.state, req.body.city, req.body.zip, req.body.date_of_birth,  req.body.gender,req.body.alternate_phone, req.body.marital_status, req.body.about, userId]
                db.query(updateQueryMeta, updateQueryData, (updateError, updateResults) => {
                    if (updateError) {
                        return res.send(
                            {
                                status: 'err',
                                data: '',
                                message: 'An error occurred while processing your request' + updateError
                            }
                        )
                    } else {
                        const query = `
                                SELECT user_meta.*, c.name as country_name, s.name as state_name, u.first_name
                                , u.last_name, u.email, u.phone, u.user_type_id, ccr.company_id as claimed_comp_id
                                FROM user_customer_meta user_meta
                                JOIN users u ON u.user_id = user_meta.user_id
                                JOIN countries c ON user_meta.country = c.id
                                JOIN states s ON user_meta.state = s.id
                                LEFT JOIN company_claim_request ccr ON user_meta.user_id = ccr.claimed_by
                                WHERE user_meta.user_id = ?
                                `;
                            db.query(query, [userId], async (err, results) => {
                            let userData = {};
                            if (results.length > 0) {
                                const user_meta = results[0];
                                //console.log(user_meta,'aaaaaaaa');
                                // Set a cookie
                                const dateString = user_meta.date_of_birth;
                                const date_of_birth_date = new Date(dateString);
                                const formattedDate = date_of_birth_date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

                                let userData = {
                                    user_id: user_meta.user_id,
                                    first_name: user_meta.first_name,
                                    last_name: user_meta.last_name,
                                    email: user_meta.email,
                                    phone: user_meta.phone,
                                    user_type_id: user_meta.user_type_id,
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
                                    profile_pic: user_meta.profile_pic,
                                    claimed_comp_id: user_meta.claimed_comp_id
                                };
                                const encodedUserData = JSON.stringify(userData);
                                res.cookie('user', encodedUserData);

                                return res.send(
                                    {
                                        status: 'ok',
                                        data: userId,
                                        message: 'Successfully Updated'
                                    }
                                )
                            } 
                        });
                        
                    }
                });
            }

        }



    });
}

// Update Terms Of Service
exports.updateGlobalContent = async (req, res) => {
    console.log('global', req.body);
    const { common_id, title, meta_title, meta_desc, meta_keyword,  footer_contact_info, footer_quick_links, footer_the_app_content,
        footer_apps_info, footer_socials_info,  footer_bottom_right } = req.body;

        const meta_value = [footer_contact_info, footer_quick_links, footer_the_app_content,
            footer_apps_info, footer_socials_info, footer_bottom_right ];
    
        const meta_key = ['footer_contact_info', 'footer_quick_links', 'footer_the_app_content',
            'footer_apps_info', 'footer_socials_info', 'footer_bottom_right' ];
    
        await meta_value.forEach((element, index) => {
            //console.log(element, index);
            const check_sql = `SELECT * FROM page_meta WHERE page_id = ? AND page_meta_key = ?`;
            const check_data = [common_id, meta_key[index]];
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
                        const update_data = [element, common_id, meta_key[index]];
                        db.query(update_sql, update_data, (update_err, update_result) => {
                            if (update_err) throw update_err;
                        })
                    } else {
                        const insert_sql = `INSERT INTO page_meta (page_id , page_meta_key, page_meta_value) VALUES (?,?,?)`;
                        const insert_data = [common_id, meta_key[index], element];
                        db.query(insert_sql, insert_data, (insert_err, insert_result) => {
                            if (insert_err) throw insert_err;
                        })
                    }
                }
            });
        });

        const title_sql = `UPDATE page_info SET title = ?, meta_title = ?, meta_desc = ?, meta_keyword = ? WHERE id  = ?`;
        const title_data = [title, meta_title, meta_desc, meta_keyword, common_id];
        //console.log(title_data);
        db.query(title_sql, title_data, (title_err, title_result) => {
            return res.send(
                {
                    status: 'ok',
                    data: '',
                    message: 'Updated successfully'
                }
            )
        })
}

//--Front end- Update Basic Company profile --//
exports.updateBasicCompany = (req, res) => {
    //console.log('updateBasicCompany:',req.body);
    //console.log('updateBasicCompany File:',req.file);
    //return false;
    const companyID = req.body.company_id;
    const companySlug = req.body.company_slug;
    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const { gallery_images } = req.files;
    let galleryImages = [];
    if(gallery_images){
         galleryImages = gallery_images.map((title, index) => ({
            gallery_images:req.files.gallery_images[index].filename
        }));
    }

    // Update company details in the company table
    const updateQuery = 'UPDATE company SET  heading = ?, logo = ?, about_company = ?, comp_phone = ?, comp_email = ?, updated_date = ?, tollfree_number = ?, main_address = ?, operating_hours = ?  WHERE ID = ?';
    const updateValues = [
                            req.body.heading,
                            '',
                            req.body.about_company,
                            req.body.comp_phone,
                            req.body.comp_email,
                            formattedDate,
                            req.body.tollfree_number,
                            req.body.main_address,
                            req.body.operating_hours,
                            companyID
                        ];

    if (req.file) {
        // Unlink (delete) the previous file
        const unlinkcompanylogo = "uploads/" + req.body.previous_logo;
        fs.unlink(unlinkcompanylogo, (err) => {
            if (err) {
                //console.error('Error deleting file:', err);
            } else {
                //console.log('Previous file deleted');
            }
        });

        updateValues[1] = req.file.filename;
    }else{
        updateValues[1] = req.body.previous_logo;
    }
    db.query(updateQuery, updateValues, (err, results) => {
        if (err) {
            // Handle the error
            return res.send({
                status: 'err',
                data: '',
                message: 'An error occurred while updating the company details: ' + err
            });
        }else{
            const check_sql = `SELECT * FROM premium_company_data WHERE company_id = ? `;
            const check_data = [companyID];
            db.query(check_sql, check_data, (check_err, check_result) => {
                if (check_err) {
                    return res.send(
                        {
                            status: 'err',
                            data: '',
                            message: 'An error occurred while processing your request'
                        }
                    )
                }else{
                    if (check_result.length > 0) {
                        //console.log(check_result[0]);
                        //return false;
                        const gallery_img = JSON.parse(check_result[0].gallery_img);
                        
                        if(galleryImages.length > 0){
                            galleryImages.forEach(function(img, index, arr) {
                                gallery_img.push(img);
                            })
                        }
                        
                        const galleryimg = JSON.stringify(gallery_img);

                        //return false;
                        const update_query = `UPDATE premium_company_data SET gallery_img = ? WHERE company_id = ?`;
                        const update_data = [galleryimg, companyID];
                        db.query(update_query, update_data, (update_err,update_result)=>{
                            if (update_err) {
                                // Handle the error
                                return res.send({
                                    status: 'err',
                                    data: '',
                                    message: 'An error occurred while updating the company details: ' + update_err
                                });
                            } else {
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: companySlug,
                                        message: 'Successfully Updated'
                                    }
                                )
                            }
                        })                        
                    }else{
                        const galleryimg = JSON.stringify(galleryImages);

                        const premium_query = `INSERT INTO premium_company_data ( company_id, gallery_img ) VALUES (?, ?)`;
                        const premium_data = [companyID, galleryimg];
                        db.query(premium_query, premium_data, (premium_err, premium_result)=>{
                            if (premium_err) {
                                // Handle the error
                                return res.send({
                                    status: 'err',
                                    data: '',
                                    message: 'An error occurred while updating the company details: ' + premium_err
                                });
                            } else {
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: companySlug,
                                        message: 'Successfully Updated'
                                    }
                                )
                            }
                        })
                    }
                }
            });
        }

        
    })
}

//--Front end- Update Basic Company profile --//
exports.updatePremiumCompany = async (req, res) => {
    console.log('PremiumCompany:',req.body);
    //console.log('PremiumCompany File:',req.files);

    const companyID = req.body.company_id;
    const companySlug = req.body.company_slug;
    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;


    const { previous_cover_image, youtube_iframe, promotion_title, promotion_desc, promotion_discount, promotion_image, product_title, product_desc, product_image, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url, support_email, escalation_one, escalation_two, escalation_three } = req.body;

    const { cover_image, gallery_images } = req.files;
    let galleryImages = [];
    if(gallery_images){
         galleryImages = gallery_images.map((title, index) => ({
            gallery_images:req.files.gallery_images[index].filename
        }));
    }

    //return false;
    if(typeof product_image == 'undefined' || typeof promotion_image == 'undefined' ){
        let product_image = [];
        let promotion_image = [];
    }
    let ProductData = [];
    if( Array.isArray(product_title) && product_title.length >0 ){
        let count = 0;
        ProductData = product_title.map((title, index) => {
            let productImage = null;
            if (product_image[index] !== '') {
                productImage = req.files.product_image[count].filename;
                count++;
            }else{
                productImage = null;
            }
        
            return {
            product_title: title,
            product_desc: product_desc[index],
            product_image: productImage
            };
        });
    } else {
        let prodkImg = null;
        if(typeof product_image != 'undefined'){
            if(product_image[0] !== ''){
                prodkImg = req.files.product_image[0].filename;
            }
        }
        
        ProductData = [{
            "product_title":product_title,
            "product_desc":product_desc,
            "product_image":prodkImg
        }]
    }

    

    let PromotionalData = [];
    if( Array.isArray(promotion_title) && promotion_title.length >0 ){
        let i = 0;
        PromotionalData = promotion_title.map((title, index) => {
            let promotionImage = null;
            if (promotion_image[index] !== '') {
                promotionImage = req.files.promotion_image[i].filename;
                i++;
            }
        
            return {
                promotion_title: title,
                promotion_desc: promotion_desc[index],
                promotion_discount: promotion_discount[index],
                promotion_image: promotionImage
            };
        });
    }else{
        let promoImg = null;
        if(typeof promotion_image != 'undefined'){
            if(promotion_image[0] !== ''){
                promoImg = req.files.promotion_image[0].filename;
            }
        }
        
        PromotionalData = [{
            "promotion_title":promotion_title,
            "promotion_desc":promotion_desc,
            "promotion_discount":promotion_discount,
            "promotion_image":promoImg
        }]
    }
    //console.log('PromotionalData:',PromotionalData)

    let coverImg = null;
    if(cover_image){
         coverImg = cover_image[0].filename;
    }else{
        coverImg = previous_cover_image;
    }


    // Update company details in the company table
    const updateQuery = 'UPDATE company SET  heading = ?, logo = ?, about_company = ?, comp_phone = ?, comp_email = ?, updated_date = ?, tollfree_number = ?, main_address = ?, operating_hours = ?  WHERE ID = ?';
    const updateValues = [
                            req.body.heading,
                            '',
                            req.body.about_company,
                            req.body.comp_phone,
                            req.body.comp_email,
                            formattedDate,
                            req.body.tollfree_number,
                            req.body.main_address,
                            req.body.operating_hours,
                            companyID
                        ];

    if (req.files.logo) {
        // Unlink (delete) the previous file
        const unlinkcompanylogo = "uploads/" + req.body.previous_logo;
        fs.unlink(unlinkcompanylogo, (err) => {
            if (err) {
                //console.error('Error deleting file:', err);
            } else {
                //console.log('Previous file deleted');
            }
        });

        updateValues[1] = req.files.logo[0].filename;
    }else{
        updateValues[1] = req.body.previous_logo;
    }
    db.query(updateQuery, updateValues, (err, results) => {
        if (err) {
            // Handle the error
            return res.send({
                status: 'err',
                data: '',
                message: '3 An error occurred while updating the company details: ' + err
            });
        }else{
            const check_sql = `SELECT * FROM premium_company_data WHERE company_id = ? `;
            const check_data = [companyID];
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
                        
                        //console.log(check_result[0]);
                        //return false;
                        const gallery_img = JSON.parse(check_result[0].gallery_img);
                        
                        if(galleryImages.length > 0){
                            galleryImages.forEach(function(img, index, arr) {
                                gallery_img.push(img);
                            })
                        }
                        //gallery_img.push(galleryImages);
        
                        //console.log('merge_img:',gallery_img);
                        
                        
                        const promotionSQL = JSON.parse(check_result[0].promotions);
                        //console.log('promotionSQL',promotionSQL);
                        //return false;
                        if(promotionSQL.length > 0){
                            promotionSQL.forEach(function(promotionImg, index, arr) {
                                if(promotionImg.promotion_image != null) {
                                    //console.log('promotion_image',promotionImg.promotion_image);
                                    if(promotion_image && promotion_image[index] == ''){
                                        
                                        PromotionalData[index].promotion_image = promotionSQL[index].promotion_image;
                                    }
                                }
                            })
                        }
                        const productSQL = JSON.parse(check_result[0].products);
                        if(productSQL.length > 0){
                            productSQL.forEach(function(productImg, index, arr) {
                                if(productImg.product_image != null) {
                                    if(product_image && product_image[index]== ''){
                                        ProductData[index].product_image = productSQL[index].product_image;
                                    }
                                }
                            })
                        }
                        // console.log('allPromotionalData',PromotionalData);
                        // console.log('allProductData',ProductData);
                        const galleryimg = JSON.stringify(gallery_img);
                        const Products = JSON.stringify(ProductData);
                        const Promotion = JSON.stringify(PromotionalData);
                        

                        //return false;
                        const update_query = `UPDATE premium_company_data SET cover_img = ?, gallery_img = ?, youtube_iframe = ?,promotions = ?, products = ?, facebook_url = ?, twitter_url = ?, instagram_url = ?, linkedin_url = ?, youtube_url = ?, support_email = ?, escalation_one = ?, escalation_two = ?, escalation_three = ? WHERE company_id = ? `;
                        const update_data = [coverImg, galleryimg, youtube_iframe, Promotion, Products, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url, support_email, escalation_one, escalation_two, escalation_three, companyID];
                        db.query(update_query, update_data, (update_err,update_result)=>{
                            if (update_err) {
                                // Handle the error
                                return res.send({
                                    status: 'err',
                                    data: '',
                                    message: '2 An error occurred while updating the company details: ' + update_err
                                });
                            } else {
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: companySlug,
                                        message: 'Successfully Updated'
                                    }
                                )
                            }
                        })
                        
                    }else {
                        const galleryimg = JSON.stringify(galleryImages);
                        const Products = JSON.stringify(ProductData);
                        const Promotion = JSON.stringify(PromotionalData);

                        const premium_query = `INSERT INTO premium_company_data ( company_id, cover_img, gallery_img, youtube_iframe, promotions, products, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url, support_email, escalation_one, escalation_two, escalation_three) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                        const premium_data = [companyID, coverImg, galleryimg, youtube_iframe, Promotion, Products, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url, support_email, escalation_one, escalation_two, escalation_three];
                        db.query(premium_query, premium_data, (premium_err, premium_result)=>{
                            if (premium_err) {
                                // Handle the error
                                return res.send({
                                    status: 'err',
                                    data: '',
                                    message: '1 An error occurred while updating the company details: ' + premium_err
                                });
                            } else {
                                return res.send(
                                    {
                                        status: 'ok',
                                        data: companySlug,
                                        message: 'Successfully Updated'
                                    }
                                )
                            }
                        })
                    }
                }
            });
        }
    })
}

// Delete premium gallery image
exports.deletePremiumImage = (req, res) => {
    //console.log('deletePremiumImage', req.body);
    ///return false;
    const { companyId, imgIndex } = req.body;


    const check_sql = `SELECT gallery_img FROM premium_company_data WHERE company_id = ? `;
    const check_data = [companyId];
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
                const gallery_img = JSON.parse(check_result[0].gallery_img);
                //console.log(gallery_img);

                const indexToRemove = imgIndex;
                if (indexToRemove >= 0 && indexToRemove < gallery_img.length) {
                    gallery_img.splice(indexToRemove, 1);
                }
                
                const galleryImg = JSON.stringify(gallery_img);

                const update_sql = `UPDATE premium_company_data SET gallery_img = ? WHERE company_id = ? `;
                const update_data = [galleryImg, companyId];
                db.query(update_sql, update_data, (update_err, update_result) => {
                    if (update_err) throw update_err;
                    return res.send(
                        {
                            status: 'ok',
                            data: '',
                            message: 'Image Deleted successfully'
                        }
                    )
                })
            }
        }
    });

    
}

// Delete premium gallery image
exports.deletePremiumPromotion = (req, res) => {
    //console.log('deletePremiumImage', req.body);
    ///return false;
    const { companyId, dataIndex } = req.body;


    const check_sql = `SELECT promotions FROM premium_company_data WHERE company_id = ? `;
    const check_data = [companyId];
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
                
                //console.log(check_result[0]);
                //return false;
                const promotions = JSON.parse(check_result[0].promotions);
                //console.log(gallery_img);

                const indexToRemove = dataIndex;
                if (indexToRemove >= 0 && indexToRemove < promotions.length) {
                    promotions.splice(indexToRemove, 1);
                }
                
                const promotionData = JSON.stringify(promotions);

                const update_sql = `UPDATE premium_company_data SET promotions = ? WHERE company_id = ? `;
                const update_data = [promotionData, companyId];
                db.query(update_sql, update_data, (update_err, update_result) => {
                    if (update_err) throw update_err;
                    return res.send(
                        {
                            status: 'ok',
                            data: '',
                            message: 'Promotion Deleted successfully'
                        }
                    )
                })
            }
        }
    });

    
}

// Delete premium gallery image
exports.deletePremiumProduct = (req, res) => {
    //console.log('deletePremiumImage', req.body);
    ///return false;
    const { companyId, dataIndex } = req.body;


    const check_sql = `SELECT products FROM premium_company_data WHERE company_id = ? `;
    const check_data = [companyId];
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
                
                //console.log(check_result[0]);
                //return false;
                const products = JSON.parse(check_result[0].products);
                //console.log(gallery_img);

                const indexToRemove = dataIndex;
                if (indexToRemove >= 0 && indexToRemove < products.length) {
                    products.splice(indexToRemove, 1);
                }
                
                const productsData = JSON.stringify(products);

                const update_sql = `UPDATE premium_company_data SET products = ? WHERE company_id = ? `;
                const update_data = [productsData, companyId];
                db.query(update_sql, update_data, (update_err, update_result) => {
                    if (update_err) throw update_err;
                    return res.send(
                        {
                            status: 'ok',
                            data: '',
                            message: 'Product Deleted successfully'
                        }
                    )
                })
            }
        }
    });

    
}

//forgot pssword
exports.forgotPassword = (req, res) => {
    //console.log('forgot',req.body);
    const {email} = req.body;
    //let hasEmail =  bcrypt.hash(email, 8);
    const passphrase = process.env.ENCRYPT_DECRYPT_SECRET;

   
    
   

    //return false;
    const sql = `SELECT user_id, first_name, register_from  FROM users WHERE email = '${email}' `;
    db.query(sql, (error, result)=>{
        if(error){
            return res.send(
                {
                    status: 'err',
                    data: '',
                    message: 'An error occurred while processing your request'
                }
            )
        }else{
            if (result.length > 0) {
                if(result[0].register_from == "google"){
                    return res.send({
                        status: 'not ok',
                        message: 'We noticed that you have logged in using your Google account. For enhanced security, please use the password reset option provided by Google to update your password.'
                    });
                } else if (result[0].register_from == "facebook"){
                    return res.send({
                        status: 'not ok',
                        message: 'We noticed that you have logged in using your Facebook account. For enhanced security, please use the password reset option provided by Facebook to update your password.'
                    });
                } else {
                    const cipher = crypto.createCipher('aes-256-cbc', passphrase);
                    let encrypted = cipher.update(email, 'utf8', 'hex');
                    encrypted += cipher.final('hex');
                    //console.log('Encrypted:', encrypted);

                    const template = `<div id="wrapper" dir="ltr" style="background-color: #f5f5f5; margin: 0; padding: 70px 0 70px 0; -webkit-text-size-adjust: none !important; width: 100%;">
                    <table height="100%" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tbody>
                    <tr>
                    <td align="center" valign="top">
                        <div id="template_header_image"><p style="margin-top: 0;"></p></div>
                        <table id="template_container" style="box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; background-color: #fdfdfd; border: 1px solid #dcdcdc; border-radius: 3px !important;" border="0" cellpadding="0" cellspacing="0" width="600">
                        <tbody>
                            <tr>
                            <td align="center" valign="top">
                            <!-- Header -->
                            <table id="template_header" style="background-color: #000; border-radius: 3px 3px 0 0 !important; color: #ffffff; border-bottom: 0; font-weight: bold; line-height: 100%; vertical-align: middle; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif;" border="0" cellpadding="0" cellspacing="0" width="600">
                                <tbody>
                                <tr>
                                <td><img alt="Logo" src="${process.env.MAIN_URL}assets/media/logos/email-template-logo.png"  style="padding: 30px 40px; display: block;  width: 70px;" /></td>
                                    <td id="header_wrapper" style="padding: 36px 48px; display: block;">
                                    <h1 style="color: #FCCB06; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 30px; font-weight: bold; line-height: 150%; margin: 0; text-align: left;">Forgot Password</h1>
                                    </td>
            
                                </tr>
                                </tbody>
                            </table>
                        <!-- End Header -->
                        </td>
                            </tr>
                            <tr>
                            <td align="center" valign="top">
                            <!-- Body -->
                            <table id="template_body" border="0" cellpadding="0" cellspacing="0" width="600">
                                <tbody>
                                <tr>
                                    <td id="body_content" style="background-color: #fdfdfd;" valign="top">
                                    <!-- Content -->
                                    <table border="0" cellpadding="20" cellspacing="0" width="100%">
                                    <tbody>
                                        <tr>
                                        <td style="padding: 48px;" valign="top">
                                        <div id="body_content_inner" style="color: #737373; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 14px; line-height: 150%; text-align: left;">
                                            
                                            <table border="0" cellpadding="4" cellspacing="0" width="90%">
                                            <tr>
                                                <td colspan="2">
                                                <strong>Hello ${result[0].first_name},</strong>
                                                <p style="font-size:15px; line-height:20px">A request has been received to change the password for your <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a>  account. <a class="btn btn-primary" href="${process.env.MAIN_URL}reset-password/${encrypted}">Click here </a>to reset your password</p>
                                                </td>
                                            </tr>
                                            </table>
                                            
                                        </div>
                                        </td>
                                        </tr>
                                    </tbody>
                                    </table>
                                    <!-- End Content -->
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                            <!-- End Body -->
                            </td>
                            </tr>
                            <tr>
                            <td align="center" valign="top">
                            <!-- Footer -->
                            <table id="template_footer" border="0" cellpadding="10" cellspacing="0" width="600">
                                <tbody>
                                <tr>
                                <td style="padding: 0; -webkit-border-radius: 6px;" valign="top">
                                <table border="0" cellpadding="10" cellspacing="0" width="100%">
                                    <tbody>
                                    <tr>
                                        <td colspan="2" id="credit" style="padding: 20px 10px 20px 10px; -webkit-border-radius: 0px; border: 0; color: #fff; font-family: Arial; font-size: 12px; line-height: 125%; text-align: center; background:#000" valign="middle">
                                            <p>This email was sent from <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a></p>
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>
                                </td>
                                </tr>
                                </tbody>
                            </table>
                            <!-- End Footer -->
                            </td>
                            </tr>
                        </tbody>
                        </table>
                    </td>
                    </tr>
                    </tbody>
                    </table>
                </div>`;
                    var mailOptions = {
                        from: process.env.MAIL_USER,
                        //to: 'pranab@scwebtech.com',
                        to: email,
                        subject: 'Forgot password Email',
                        html: template
                    }
              
                    mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
                      if (err) {
                          console.log(err);
                          return res.send({
                              status: 'not ok',
                              message: 'Something went wrong'
                          });
                      } else {
                          console.log('Mail Send: ', info.response);
                          return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Forgot password email sent. Please check the email for next steps.'
                            }
                        )
                      }
                    })
                }
                
                
                
            } else {
                return res.send(
                    {
                        status: 'not found',
                        data: '',
                        message: 'Your Email did not match with our record.'
                    }
                )
            }
        }
    })
}


//--Submit Review Reply----//
exports.submitReviewReply = async (req, res) => {
    const encodedUserData = req.cookies.user;
    //console.log(req.body);
    try {
        if (encodedUserData) {
            const currentUserData = JSON.parse(encodedUserData);
            console.log(currentUserData);
            const loginCompanyUserId = currentUserData.user_id;
            if(loginCompanyUserId == req.body.reply_by){
                const currentDate = new Date();
                const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

                const replyData = [req.body.review_id, req.body.company_id, req.body.reply_by, req.body.reply_to, req.body.comment,'2',formattedDate, formattedDate]

                db.query('INSERT INTO review_reply (review_id, company_id, reply_by, reply_to, comment, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', replyData, async (err, results) => {
                    if (err) {
                        return res.status(500).json({
                          status: 'error',
                          message: 'An error occurred while processing your request'+err,
                        });
                    }else {
                        console.log(results.insertId);
                        const mailReplyData =await comFunction2.ReviewReplyTo(results.insertId)

                        console.log('MailSendTo',mailReplyData);
                        if(mailReplyData[0].customer_id == req.body.reply_to ){
                            await comFunction2.ReviewReplyToCustomer(mailReplyData)
                        }else{
                            await comFunction2.ReviewReplyToCompany(mailReplyData)
                        }
                       

                        return res.send(
                            {
                                status: 'ok',
                                data: '',
                                message: 'Reply Successfully Sent'
                            }
                        );
                    }
                    

                });
            }else{
                return res.send(
                    {
                        status: 'error',
                        data: '',
                        message: 'Error occurred : Illegal activities'
                    }
                ); 
            }
        } else {
            //res.redirect('sign-in');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('An error occurred '+ err);
    }
}

// Reset Password
exports.resetPassword = async (req, res) => {
    //console.log('resetPassword', req.body);
    const  { email, new_password } = req.body;
    let hasPassword = await bcrypt.hash(new_password, 8);
    //console.log(hasPassword);
    const check_query = `SELECT user_id, email FROM users WHERE email = '${email}' `;
    db.query(check_query,(check_err, check_result)=>{
        if (check_err) {
            //console.log(check_err);
            return res.send({
                status: 'not ok',
                message: 'Something went wrong'+check_err
            });
        } else {
            if (check_result.length > 0) {
                const sql = `UPDATE users SET password = ?  WHERE email = ? `;
                const data = [hasPassword, email];
                db.query(sql, data, (err, result) =>{
                    if (err) {
                        console.log(err);
                        return res.send({
                            status: 'not ok',
                            message: 'Something went wrong'+err
                        });
                    } else {
                        //Wprdpress User reset password.
                        (async () => {
                            try {
                                const wpUserLoginData = {
                                    email: email,
                                    password: new_password,
                                };
                                const response = await axios.post(process.env.BLOG_API_ENDPOINT + '/reset-password', wpUserLoginData);
                                //console.log(response);
                                const wp_user_data = response.data;
                                //console.log(wp_user_data);
                                if(wp_user_data.status=='ok'){
                                    return res.send(
                                        {
                                            status: 'ok',
                                            data: wp_user_data.data,
                                            message: 'Password Update Successfully'
                                        }
                                    )
                                }else{
                                    return res.send(
                                        {
                                            status: 'err',
                                            data: '',
                                            message: wp_user_data.message
                                        }
                                    )
                                }
                            } catch (error) {
                                console.log('axaxa', error);
                                return res.send(
                                    {
                                        status: 'err',
                                        data: '',
                                        message: ''
                                    }
                                )
                            }
                        })();
                    }
                })
            } else {
                return res.send({
                    status: 'not ok',
                    message: 'Your URL is not valid please check or request for another URL'
                });
            }
        }
    })
    
}
// Change Password
exports.changePassword = async (req, res) => {
    //console.log('changePassword', req.body);
    const {userid, current_password, new_password } = req.body;
    let CurrentHasPassword = await bcrypt.hash(current_password, 8);
    let hasPassword = await bcrypt.hash(new_password, 8);
    const check_query = `SELECT password, email  FROM users WHERE user_id = '${userid}' `;
    db.query(check_query,(check_err, check_result)=>{
        if (check_err) {
            //console.log(check_err);
            return res.send({
                status: 'not ok',
                message: 'Something went wrong'+check_err
            });
        } else {
            if (check_result.length > 0) {
                const userPassword = check_result[0].password
                console.log('userPassword',userPassword,'CurrentHasPassword',CurrentHasPassword)
                bcrypt.compare(current_password, userPassword, (err, result) => {
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
                        const sql = `UPDATE users SET password = ?  WHERE user_id = '${userid}' `;
                        const data = [hasPassword, userid];
                        db.query(sql, data, (err, result) =>{
                            if (err) {
                                console.log(err);
                                return res.send({
                                    status: 'not ok',
                                    message: 'Something went wrong'+err
                                });
                            } else {
                                //Wprdpress User reset password.
                                (async () => {
                                    try {
                                        const wpUserLoginData = {
                                            email: check_result[0].email,
                                            password: new_password,
                                        };
                                        const response = await axios.post(process.env.BLOG_API_ENDPOINT + '/reset-password', wpUserLoginData);
                                        //console.log(response);
                                        const wp_user_data = response.data;
                                        //console.log(wp_user_data);
                                        if(wp_user_data.status=='ok'){
                                            return res.send(
                                                {
                                                    status: 'ok',
                                                    data: wp_user_data.data,
                                                    message: 'Password Update Successfully'
                                                }
                                            )
                                        }else{
                                            return res.send(
                                                {
                                                    status: 'err',
                                                    data: '',
                                                    message: wp_user_data.message
                                                }
                                            )
                                        }
                                    } catch (error) {
                                        console.log('axaxa', error);
                                        return res.send(
                                            {
                                                status: 'err',
                                                data: '',
                                                message: ''
                                            }
                                        )
                                    }
                                })();
                            }
                        })
                    }else {
                        return res.send({
                            status: 'not ok',
                            message: 'Current Password is not correct!'
                        });
                    }
                })
                
            } else {
                return res.send({
                    status: 'not ok',
                    message: 'User is not valid'
                });
            }
        }
    })
}

// Review voting (like dislike)
exports.reviewVoting = async (req, res) => {
    //console.log('reviewVoting', req.body);
    const {votingValue, userId, reviewId} = req.body;
    const checkQuery = `SELECT id FROM review_voting WHERE 	review_id = '${reviewId}' AND customer_id = '${userId}' `;
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    db.query(checkQuery, (checkErr, checkResult) => {
        if(checkErr){
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+checkErr
            });
        }else{
            if(checkResult.length > 0){
                const updateQuery = `UPDATE review_voting SET voting = ?, updated_at = ? WHERE 	review_id = ? AND customer_id = ? `;
                const updateData = [votingValue, formattedDate, reviewId, userId];
                db.query(updateQuery, updateData, async (updateErr, updateRes)=>{
                    if(updateErr){
                        return res.send({
                            status: 'not ok',
                            message: 'Something went wrong '+updateErr
                        });
                    } else {
                        const totalLike = await comFunction2.countLike(reviewId);
                        const totalDislike = await comFunction2.countDislike(reviewId);
                        console.log('update:',totalLike,totalDislike)
                        return res.send({
                            status: 'ok',
                            data:updateRes,
                            totalLike:totalLike,
                            totalDislike:totalDislike,
                            reviewId:reviewId,
                            votingValue:votingValue,
                            message: 'Voting successfully updated'
                        });
                    }
                })
            } else {
                const insertQuery = `INSERT INTO review_voting( review_id, customer_id, voting, created_at, updated_at) VALUES (?,?,?,?,?)`;
                const insertData = [reviewId, userId, votingValue, formattedDate, formattedDate ];
                db.query(insertQuery, insertData, async (insertErr, insertRes)=>{
                    if(insertErr){
                        return res.send({
                            status: 'not ok',
                            message: 'Something went wrong '+insertErr
                        });
                    } else {
                        const totalLike = await comFunction2.countLike(reviewId);
                        const totalDislike = await comFunction2.countDislike(reviewId);
                        console.log('insert:',totalLike,totalDislike)
                        return res.send({
                            status: 'ok',
                            data:insertRes,
                            totalLike:totalLike,
                            totalDislike:totalDislike,
                            reviewId:reviewId,
                            votingValue:votingValue,
                            message: 'Voting successfully inserted'
                        });
                    }
                })
            }
        }
    })
}
// Create poll
exports.createPoll = async (req, res) => {
    //console.log('createPoll',req.body );
    const {company_id, user_id, poll_question, poll_answer, expire_date} = req.body;
    //const answers = JSON.stringify(poll_answer);
     const currentDate = new Date();
    // const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Months are zero-based (0 = January, 11 = December), so add 1
    const day = currentDate.getDate();
    const formattedDate = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    const sql = `INSERT INTO poll_company ( company_id, poll_creator_id, question, created_at, expired_at) VALUES (?,?,?,?,?)`;
    const data = [company_id, user_id, poll_question, formattedDate, expire_date];
    db.query(sql, data,async (err, result) => {
        if(err){
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+err
            });
        } else {
            await poll_answer.forEach((answer)=>{
                const ansQuery = `INSERT INTO poll_answer ( poll_id, answer) VALUES (?,?)`;
                const ansData = [result.insertId, answer];
                 db.query(ansQuery, ansData, (ansErr, ansResult)=>{
                    if(ansErr){
                        return res.send({
                            status: 'not ok',
                            message: 'Something went wrong '+ansErr
                        });
                    } 
                })
            })

            return res.send({
                status: 'ok',
                message: 'Poll Created Successfully'
            });
        }
    })
}

// Update poll expire date
exports.updatePollExpireDate = async (req, res) => {
    //console.log('updatePollExpireDate',req.body );
    const {poll_id,change_expire_date} = req.body;
    const sql = `UPDATE poll_company SET expired_at = ? WHERE id = ?`;
    const data= [change_expire_date, poll_id]
    db.query(sql,data, (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Expire Date Updated Successfully'
            });
        }
    })
}

// User polling
exports.userPolling = async (req, res) => {
    //console.log('userPolling',req.body );
    const {ansId, pollId, userId} = req.body
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const sql = `INSERT INTO poll_voting ( poll_id, answer_id, user_id, voting_date) VALUES (?, ?, ?, ?)`;
    const data = [pollId, ansId, userId, formattedDate ];
    db.query(sql, data, (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Your Poll Submited Successfully'
            });
        }
    } )
}

// Review Invitation
exports.reviewInvitation = async (req, res) => {
    //console.log('reviewInvitation',req.body );
    const {emails, email_body, user_id, company_id, company_name } = req.body;
    const [InvitationDetails, sendInvitationEmail] = await Promise.all([
        comFunction2.insertInvitationDetails(req.body),
        comFunction2.sendInvitationEmail(req.body)
    ]);

    return res.send({
        status: 'ok',
        message: 'Invitation emails send successfully'
    });
}

//--- review Bulk Invitation ----//
exports.reviewBulkInvitation = async (req, res) => {
    //console.log('reviewBulkInvitation',req.body);
    //console.log('reviewBulkInvitation',req.file);
    const { email_body, user_id, company_id, company_name } = req.body;

    if (!req.file) {
        return res.send(
            {
                status: 'err',
                data: '',
                message: 'No file uploaded.'
            }
        )        
    }
    const csvFilePath = path.join(__dirname, '..', 'company-csv', req.file.filename);
    try {   
        const connection = await mysql.createConnection(dbConfig);

        const workbook = new ExcelJS.Workbook();
        await workbook.csv.readFile(csvFilePath);

        const worksheet = workbook.getWorksheet(1);
        const emailsArr = await processReviewCSVRows(worksheet);
        const emails = emailsArr.flat();

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
      
        const get_company_review_invite_request_query = `
            SELECT *
            FROM review_invite_request
            WHERE company_id = ${company_id}
            AND YEAR(share_date) = ${currentYear}
            AND MONTH(share_date) = ${currentMonth}
            ORDER BY id DESC 
            `;
            
        const get_company_review_invite_request_result = await query(get_company_review_invite_request_query);
        let total_count = 0;
        if(get_company_review_invite_request_result.length > 0){
            get_company_review_invite_request_result.forEach(count=>{
              total_count = total_count + count.count;
            })
          }
        if (emails.length + total_count > req.body.email_limite) {
            return res.send(
                {
                    status: 'err',
                    message: 'You have reached your maximum limit of emails allowed on your current membership for this month.'
                }
            )  
        } else {
            req.body.emails = emails;
            console.log('emails',emails);
            console.log('req.body',req.body);
            const [InvitationDetails, sendInvitationEmail] = await Promise.all([
                comFunction2.insertInvitationDetails(req.body),
                comFunction2.sendInvitationEmail(req.body)
            ]);

            return res.send(
                {
                    status: 'ok',
                    message: 'Invitation emails send successfully.'
                }
            )
        }
          
        
    } catch (error) {
        console.error('Error:', error);
        return res.send({
            status: 'err',
            message: error.message
        });
    } finally {
        // Delete the uploaded CSV file
        //fs.unlinkSync(csvFilePath);
    }
}

// Define a promise-based function for processing review invitation csv
function processReviewCSVRows(worksheet) {
    return new Promise(async (resolve, reject) => {
        const emails = [];

        await worksheet.eachRow(async (row, rowNumber) => {
            if (rowNumber !== 1) { // Skip the header row
                
                emails.push([ row.values[1] ]);

            }
        });

        // Resolve the promise after all rows have been processed
        resolve(emails);
    });
}

//--- survey Bulk Invitation ----//
exports.surveyBulkInvitation = async (req, res) => {
    //console.log('surveyBulkInvitation',req.body);
    //console.log('surveyBulkInvitation',req.file);
    //return false;
    const { email_body, user_id, company_id, company_name, company_slug, survey_id, unique_id  } = req.body;

    if (!req.file) {
        return res.send(
            {
                status: 'err',
                data: '',
                message: 'No file uploaded.'
            }
        )        
    }
    const csvFilePath = path.join(__dirname, '..', 'company-csv', req.file.filename);
    try {   
        const connection = await mysql.createConnection(dbConfig);

        const workbook = new ExcelJS.Workbook();
        await workbook.csv.readFile(csvFilePath);

        const worksheet = workbook.getWorksheet(1);
        const emailsArr = await processReviewCSVRows(worksheet);
        const emails = emailsArr.flat();
        if (emails.length > 100) {
            return res.send(
                {
                    status: 'err',
                    message: 'You can not add more than 100 email id`s in your current membership.'
                }
            )  
        } else {
            req.body.emails = emails;
            console.log('emails',emails);
            console.log('req.body',req.body);
            
                const [ sendSurveyInvitationEmail] = await Promise.all([
                    comFunction2.sendSurveyInvitationEmail(req.body)
                ]);

                return res.send({
                    status: 'ok',
                    message: 'Survey Invitation emails send successfully'
                });
        }
          
        
    } catch (error) {
        console.error('Error:', error);
        return res.send({
            status: 'err',
            message: error.message
        });
    } finally {
        // Delete the uploaded CSV file
        //fs.unlinkSync(csvFilePath);
    }
}

//Add  Review Flag
exports.addReviewFlag = async (req, res) => {
    //console.log('addReviewFlag',req.body );
    const [addFlagDetails, sendFlagEmail] = await Promise.all([
        comFunction2.addFlagDetails(req.body),
        comFunction2.sendFlagEmail(req.body)
    ]);

    return res.send({
        status: 'ok',
        message: 'Flag added successfully',
        slug: req.body.company_slug
    });
}

//Add  Review Flag site admin response
exports.updateReviewFlag = async (req, res) => {
    //console.log('updateReviewFlag',req.body ); 
    const [updateFlagDetails] = await Promise.all([
        comFunction2.updateFlagDetails(req.body),
        comFunction2.flagApprovedEmail(req.body),
        comFunction2.flagRejectdEmail(req.body),
    ]);
    return res.send({
        status: 'ok',
        message: 'Flag update successfully',
    });
    //return res.redirect('/flag-review');
}

//create new discussion
exports.createDiscussion = async (req, res) => {
    //console.log('createDiscussion',req.body ); 
    //return false;
    const {user_id, tags, topic, from_data, expire_date} = req.body;
    const strTags = JSON.stringify(tags);
    const sql = `INSERT INTO discussions ( user_id, topic, tags, created_at, expired_at, query_alert_status) VALUES (?, ?, ?, ?, ?, ?)` ;
    const data = [user_id, topic, strTags, from_data, expire_date, '0'];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Your Discussion Topic Added Successfully'
            });
        }
    })
}

//Add comment on discussion
exports.addComment = async (req, res) => {
    console.log('addComment',req.body ); 
    const {discussion_id, user_id,  comment } = req.body;
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    //return false;
    const Insertdata = {
        discussion_id : discussion_id,
        user_id:user_id,
        comment:comment,
        ip_address: requestIp.getClientIp(req),
        created_at: formattedDate,
      };
    const insertQuery = 'INSERT INTO discussions_user_response SET ?';
    db.query(insertQuery, Insertdata, (insertErr, insertResult)=>{
        if (insertErr) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong 3'+insertErr
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Your Comment Added Successfully'
            });
        }
    })
    
}

//Create company category
exports.createCompanyCategory = async (req, res) => {
    console.log('createCompanyCategory',req.body ); 
    console.log('createCompanyCategoryFile',req.files ); 
    //return false;
    const {category_name, parent_category, company_id, product_title, product_desc } = req.body;
    const {product_image} = req.files;

    const checkQuery = `SELECT id FROM complaint_category WHERE category_name = '${category_name}' AND company_id = '${company_id}' `;
    db.query(checkQuery, (checkErr, checkResult)=>{
        if (checkErr) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+checkErr
            });
        }
        if (checkResult.length > 0) {
            return res.send({
                status: 'not ok',
                message: 'Category name already exist.'
            });
        } else {
            const sql = `INSERT INTO complaint_category ( company_id, category_name, parent_id) VALUES (?, ?, ?)`;
            const data = [company_id, category_name, parent_category ];
            db.query(sql, data, async (err, result) => {
                if (err) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+err
                    });
                } else {
                    if (typeof product_title !== 'undefined' ) {
                        if (typeof product_title == 'string') {
                            console.log(result.insertId);
                            //return false;
                            const productQuery = `INSERT INTO company_products SET ? ` ;
                            const productData = {
                                company_id :company_id,
                                category_id :result.insertId,
                                parent_id:parent_category,
                                product_title :product_title,
                                product_desc :product_desc,
                                product_img :product_image[0].filename,
                            }
                            db.query(productQuery, productData, (productErr, productResult)=>{
                                if (productErr) {
                                    return res.send({
                                        status: 'not ok',
                                        message: 'Something went wrong '+productErr
                                    });
                                } else {
                                    return res.send({
                                        status: 'ok',
                                        message: 'Category added successfully with a product !'
                                    });
                                }
                            });
                        } else {
                           await product_title.forEach((product, index)=>{
                                const productQuery = `INSERT INTO company_products SET ? ` ;
                                const productData = {
                                    company_id :company_id,
                                    category_id :result.insertId,
                                    parent_id:parent_category,
                                    product_title :product,
                                    product_desc :product_desc[index],
                                    product_img :product_image[index].filename,
                                }
                                db.query(productQuery, productData, (productErr, productResult)=>{
                                    if (productErr) {
                                        return res.send({
                                            status: 'not ok',
                                            message: 'Something went wrong '+productErr
                                        });
                                    }
                                });
                            })
                            return res.send({
                                status: 'ok',
                                message: 'Category added successfully with products. '
                            });
                        }
                    } else {
                        return res.send({
                            status: 'ok',
                            message: 'Category added successfully without any product. '
                        });
                    }
                }
            })
        }
    })
}

//Delete company category
exports.deleteCompanyCategory = async (req, res) => {
    //console.log('deleteCompanyCategory',req.body ); 
    const checkQuery = `SELECT id, parent_id FROM complaint_category WHERE parent_id = '0' AND id = ${req.body.cat_id}`;
    db.query(checkQuery,(checkErr,checkResult)=>{
    
        if (checkErr) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong 1'+checkErr
            });
        } else {
            const delQuery = `DELETE FROM complaint_category WHERE id = '${req.body.cat_id}'`;
            db.query(delQuery,(err, result)=>{
                if (checkResult.length > 0 ) {
                    const updateQuery = `UPDATE complaint_category SET  parent_id = '0' WHERE parent_id = '${req.body.cat_id}' `;
                    db.query(updateQuery, (updateErr, updateResult)=>{
                        if (updateErr) {
                            return res.send({
                                status: 'not ok',
                                message: 'Something went wrong 2'+updateErr
                            });
                        } else {
                            return res.send({
                                status: 'ok',
                                message: 'Category Deleted successfully !'
                            });
                        }
                    })
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Category Deleted successfully !'
                    });
                }
            })
        }
    })
}

//Delete company product
exports.deleteCompanyProduct = async (req, res) => {
    console.log('deleteCompanyProduct',req.body ); 
    //return false;
    const delQuery = `DELETE FROM company_products WHERE id = '${req.body.product_id}'`;
    db.query(delQuery,(err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong 2 '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Product Deleted successfully !'
            });
        }
    })
}

//update Company Product
exports.updateCompanyProduct = async (req, res) => {
    console.log('updateCompanyProduct',req.body ); 
    console.log('file',req.file ); 
    const {company_Id, product_Id, product_title, product_desc } = req.body;
    //const {product_img} = req.file;
    let data = {}
    //return false;
    if (req.file) {
        data = {
            product_title:product_title,
            product_desc:product_desc,
            product_img:req.file.filename 
        }
    } else {
        data = {
            product_title:product_title,
            product_desc:product_desc
        }
    }
    console.log('data', data)
    const sql = `UPDATE company_products SET ? WHERE id = ${product_Id}` ;
    db.query(sql, data, (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Category Product Updated successfully !'
            });
        }
    })
}

//Add  company product
exports.addCompanyProduct = async (req, res) => {
    console.log('addCompanyProduct',req.body ); 
    console.log('addCompanyProduct',req.files ); 
    //return false;
    const {category_id, parent_id, company_id, product_title, product_desc } = req.body;
    const {product_image} = req.files;

    if (typeof product_title !== 'undefined' ) {
        if (typeof product_title == 'string') {
            //console.log(result.insertId);
            //return false;
            const productQuery = `INSERT INTO company_products SET ? ` ;
            const productData = {
                company_id :company_id,
                category_id :category_id,
                parent_id:parent_id,
                product_title :product_title,
                product_desc :product_desc,
                product_img :product_image[0].filename,
            }
            db.query(productQuery, productData, (productErr, productResult)=>{
                if (productErr) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+productErr
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Product added successfully !'
                    });
                }
            });
        } else {
           await product_title.forEach((product, index)=>{
                const productQuery = `INSERT INTO company_products SET ? ` ;
                const productData = {
                    company_id :company_id,
                    category_id :category_id,
                    parent_id:parent_id,
                    product_title :product,
                    product_desc :product_desc[index],
                    product_img :product_image[index].filename,
                }
                db.query(productQuery, productData, (productErr, productResult)=>{
                    if (productErr) {
                        return res.send({
                            status: 'not ok',
                            message: 'Something went wrong '+productErr
                        });
                    }
                });
            })
            return res.send({
                status: 'ok',
                message: 'Products added successfully . '
            });
        }
    } else {
        return res.send({
            status: 'ok',
            message: 'Please add products. '
        });
    }
}

//Update complaint company category
exports.updateCompanyCategory = async (req, res) => {
    //console.log('updateCompanyCategory',req.body ); 
    const {category_name,parent_category, company_id, cat_id } = req.body ;
    //return false;
    const checkQuery = `SELECT id FROM complaint_category WHERE category_name = '${category_name}' AND id != ${cat_id}`;
    db.query(checkQuery, (checkErr, checkResult)=>{
        if (checkErr) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+checkErr
            });
        }
        if (checkResult.length > 0) {
            return res.send({
                status: 'not ok',
                message: 'Category name already exist.'
            });
        } else {
            const data = [category_name, parent_category, cat_id];
            const delQuery = `UPDATE complaint_category SET category_name = ?, parent_id = ? WHERE id = ? `;
            db.query(delQuery, data, (err, result)=>{
                if (err) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+err
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Category Updated successfully !'
                    });
                }
            })
        }
    })

}

//createCompanyLevel
exports.createCompanyLevel = async (req, res) => {
    console.log('createCompanyLevel',req.body ); 
    const {company_id, label_count, eta_days, emails} = req.body;
    let emailsArr = [];
    if (typeof emails == 'string') {
        emailsArr.push(emails);
    } else {
        emailsArr = [...emails];
    }
    //const filteredArray = emailsArr.filter(item => item !== "");
    //console.log('emailsArr', emailsArr);
    const strEmails = JSON.stringify(emailsArr.filter(item => item !== ""));
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const checkQuery = `SELECT id FROM complaint_level_management WHERE company_id  = ? AND level = ? `;
    const checkData = [company_id, label_count ];
    db.query(checkQuery, checkData, (checkErr, checkResult)=>{
        if (checkErr) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+checkErr
            });
        }
        if (checkResult.length > 0) {
            const updateQuery = `UPDATE complaint_level_management SET ? WHERE company_id  = '${company_id}' AND level = '${label_count}' `;
            const updateData = {
                level: label_count || null,
                emails: strEmails || [],
                eta_days: eta_days || null,
                created_at: formattedDate || null,
            };

            db.query(updateQuery, updateData, (updateErr, updateRes)=>{
                if (updateErr) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+updateErr
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Level data Updated successfully !'
                    });
                }
            } )
            
        } else {
            const insertQuery = `INSERT INTO complaint_level_management SET ?`;
            const insertData = {
                company_id:company_id,
                level: label_count || null,
                emails: strEmails || [],
                eta_days: eta_days || null,
                created_at: formattedDate || null,
            }
            db.query(insertQuery, insertData, (insertErr, insertRes)=>{
                if (insertErr) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+insertErr
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Level data added successfully !'
                    });
                }
            } )
        }
    } )
}

//Delete company Complaint Level
exports.deleteCompanyComplaintLevel = async (req, res) => {
    //console.log('deleteCompanyComplaintLevel',req.body ); 
    //return false;
    const delQuery = `DELETE FROM complaint_level_management WHERE id = '${req.body.level_id}'`;
    db.query(delQuery,(err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong 2 '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Complaint Level  Deleted successfully !'
            });
        }
    })
}

//Complaint Register
exports.complaintRegister =  (req, res) => {
    //console.log('complaintRegister',req.body ); 
    // const authenticatedUserId = parseInt(req.user.user_id);
    // const ApiuserId = parseInt(req.body.user_id);
    // if (isNaN(ApiuserId)) {
    //     return res.status(400).json({
    //       status: 'error',
    //       message: 'Invalid user_id provided in the request body.',
    //     });
    //   }
    // if (ApiuserId !== authenticatedUserId) {
    // return res.status(403).json({
    //     status: 'error',
    //     message: 'Access denied: You are not authorized to update this user.',
    // });
    // }

    const {company_id, user_id, category_id, sub_category_id, model_no, allTags, transaction_date, location, message } = req.body;
    //return false;
    //const uuid = uuidv4();  
    const randomNo = Math.floor(Math.random() * (100 - 0 + 1)) + 0 ;
    const currentDate = new Date();
    const ticket_no = randomNo + currentDate.getTime();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const data = {
        user_id:user_id,
        company_id:company_id,
        ticket_id:ticket_no,
        category_id:category_id,
        sub_cat_id : sub_category_id && sub_category_id !== undefined  ? sub_category_id : 0,
        model_desc:model_no,
        purchase_date:transaction_date,
        purchase_place:location,
        message:message,
        tags:JSON.stringify(allTags),
        level_id:'1',
        status:'2',
        created_at:formattedDate,
        level_update_at:formattedDate
    }

    
   // console.log(complaintEmailToCompany);
    const Query = `INSERT INTO complaint SET ?  `;
    db.query(Query, data, async (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong  '+err
            });
        } else {
            //console.log(company_id[0],user_id[0], uuid, result.insertId)
            const [complaintEmailToCompany,complaintSuccessEmailToUser] = await Promise.all([
                comFunction2.complaintEmailToCompany(company_id[0], ticket_no, result.insertId),
                comFunction2.complaintSuccessEmailToUser(user_id[0], ticket_no, result.insertId)
            ]);
            return res.send({
                status: 'ok',
                message: 'Complaint Registered  successfully !'
            });
        }
    })
}

//Insert Company Query and  to user
exports.companyQuery = async (req, res) => {
    //console.log('companyQuery',req.body ); 
    //return false;
    const {company_id, user_id, complaint_id, message, complaint_status, complaint_level, company_slug } = req.body;
    
    if (complaint_status == '1') {
        const [updateComplaintStatus, complaintCompanyResolvedEmail] = await Promise.all([
            comFunction2.updateComplaintStatus(complaint_id, '1'),
             comFunction2.complaintCompanyResolvedEmail(complaint_id)
        ]);
    } else {
        await comFunction2.complaintCompanyResponseEmail(complaint_id)
    }
    
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const data = {
        user_id:user_id,
        company_id:company_id,
        complaint_id :complaint_id,
        query:message,
        response : '',
        created_at:formattedDate,
        level_id:complaint_level,
        notification_status: '0',
        resolve_status:complaint_status
    }
     const Query = `INSERT INTO complaint_query_response SET ?  `;
    db.query(Query, data, (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong  '+err
            });
        } else {
            if (complaint_status == '1' ) {
                return res.send({
                    status: 'ok',
                    slug:company_slug,
                    message: 'Complaint resolved successfully !'
                });
            } else {
                return res.send({
                    status: 'ok',
                    slug:company_slug,
                    message: 'Complaint query send successfully !'
                });
            }
            
        }
    })
}

//user Complaint Rating
exports.userComplaintRating = async (req, res) => {
    //console.log('userComplaintRating',req.body ); 
    //return false;
    const { user_id, complaint_id, rating } = req.body;
    
    const data = {
        user_id:user_id,
        complaint_id:complaint_id,
        rating:rating,
    }
    const checkQuery = `SELECT id FROM complaint_rating WHERE complaint_id = '${complaint_id}' AND user_id = '${user_id}' `;
    db.query(checkQuery, (checkErr, checkResult)=>{
        if(checkErr){
            return res.send({
                status: 'not ok',
                message: 'Something went wrong  '+checkErr
            });
        }
        if (checkResult.length > 0) {
            const updateQuery = `UPDATE complaint_rating SET rating='${rating}' WHERE complaint_id = '${complaint_id}' AND user_id = '${user_id}' `;
            db.query(updateQuery, (updateErr, updateResult)=>{
                if (updateErr) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong  '+updateErr
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Complaint rating updated successfully !'
                    });
                }
            })
        } else {
            const Query = `INSERT INTO complaint_rating SET ?  `;
            db.query(Query, data, (err, result)=>{
                if (err) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong  '+err
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Complaint rating submitted successfully !'
                    });
                }
            })
        }
    })
    
}

//Insert user Complaint Response  to company
exports.userComplaintResponse = async (req, res) => {
    //console.log('userComplaintResponse',req.body ); 
    //return false;
    const {company_id, user_id, complaint_id, message, complaint_level, complaint_status } = req.body;
    
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

    
    if (complaint_status == '0') {
        const [updateComplaintStatus, complaintCompanyResolvedEmail] = await Promise.all([
            comFunction2.updateComplaintStatus(complaint_id, '0'),
             comFunction2.complaintUserReopenEmail(complaint_id)
        ]);
    } else {
        await comFunction2.complaintUserResponseEmail(complaint_id);
    }

    const data = {
        user_id:user_id,
        company_id:company_id,
        complaint_id :complaint_id,
        query:'',
        response : message,
        created_at:formattedDate,
        level_id:complaint_level,
        notification_status:'0',
        resolve_status:complaint_status
    }
     const Query = `INSERT INTO complaint_query_response SET ?  `;
    db.query(Query, data, (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong  '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Complaint response send successfully !'
            });
        }
    })
}

// Create Survey
exports.createSurvey = async (req, res) => {
    console.log( 'Survey Response', req.body );
    const jsonString = Object.keys(req.body)[0];
    const surveyResponse = JSON.parse(jsonString);
    //console.log(surveyResponse[0].questions);

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Months are zero-based (0 = January, 11 = December), so add 1
    const day = currentDate.getDate();
    const formattedDate = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    const uniqueNumber = Date.now().toString().replace(/\D/g, "");

    const surveyInsertData = [
        uniqueNumber,
        surveyResponse[0].company_id,
        formattedDate,
        surveyResponse[0].expire_at,
        surveyResponse[0].title,
        JSON.stringify(surveyResponse[0].questions)
    ];
    const sql = "INSERT INTO survey (unique_id, company_id, created_at, expire_at, title, questions) VALUES (?, ?, ?, ?, ?, ?)";

    db.query(sql, surveyInsertData, async (err, result) => {
        if(err){
            return res.send({
                status: 'error',
                message: err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Survey successfully created'
            });
        }
    })
}

// Update Survey
exports.updateSurvey = async (req, res) => {
    //console.log( 'Survey Response', req.body );
    
    const survey_update_query = 'UPDATE survey SET expire_at = ? WHERE id = ?';
    const values = [req.body.expire_at, req.body.survey_id];
    db.query(survey_update_query, values, (err, survey_update_query_results) => {
        return res.send(
            {
                status: 'ok',
                data: '',
                message: 'Survey successful updated'
            }
        )
    })
}

// Create Survey Answer
exports.createSurveyAnswer = async (req, res) => {
    console.log( 'Survey Response', req.body );
    const jsonString = Object.keys(req.body)[0];
    const surveyAnswerResponse = JSON.parse(jsonString);
    console.log(surveyAnswerResponse);

    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Months are zero-based (0 = January, 11 = December), so add 1
    const day = currentDate.getDate();
    const formattedDate = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;

    const surveyAnswerInsertData = [
        surveyAnswerResponse[0].company_id,
        surveyAnswerResponse[0].survey_unique_id,
        surveyAnswerResponse[0].customer_id,
        JSON.stringify(surveyAnswerResponse[0].answers),
        formattedDate
    ];
    const sql = "INSERT INTO survey_customer_answers (company_id, survey_unique_id, customer_id, answer, created_at) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, surveyAnswerInsertData, async (err, result) => {
        if(err){
            return res.send({
                status: 'error',
                message: err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Your survey answers successfully submitted'
            });
        }
    })
}


// Survey Invitation
exports.surveyInvitation = async (req, res) => {
    console.log('surveyInvitation',req.body );
    //return false;
    const {emails, email_body, user_id, company_id, company_name, company_slug, survey_id, unique_id  } = req.body;
    const [ sendSurveyInvitationEmail] = await Promise.all([
        comFunction2.sendSurveyInvitationEmail(req.body)
    ]);

    return res.send({
        status: 'ok',
        message: 'Survey Invitation emails send successfully'
    });
}

//Delete Discussion 
exports.deleteDiscussion = async (req, res) => {
    //console.log('deleteDiscussion',req.body ); 
    //return false;
    const delQuery = `DELETE FROM discussions WHERE id = '${req.body.discussionid}'`;
    db.query(delQuery,(err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong 2 '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Discussion Deleted successfully !'
            });
        }
    })
}

//discussion company create tags
exports.companyCreateTags = async (req, res) => {
    console.log('createDiscussion',req.body ); 
    //return false;
    const { user_id, tags, company_id } = req.body;
    const strTags = JSON.stringify(tags);
    checkQuery = `SELECT * FROM duscussions_company_tags WHERE company_id = '${company_id}' `;
    db.query(checkQuery,(checkErr, checkResult)=>{
        if (checkErr) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+checkErr
            });
        }
        if (checkResult.length > 0) {
            let preTags = JSON.parse(checkResult[0].tags);
            const joinTags = preTags.concat(tags);
            let uniqueArray = joinTags.filter((it, i, ar) => ar.indexOf(it) === i);
            const updateTags = JSON.stringify(uniqueArray);
            //console.log(tags, preTags,joinTags, uniqueArray)
            const sql = `UPDATE duscussions_company_tags SET tags = ? WHERE company_id = ? ` ;
            const data = [ updateTags, company_id];
            db.query(sql, data, (err, result) => {
                if (err) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+err
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Your Discussion Tags Updated Successfully'
                    });
                }
            })
        } else {
            const sql = `INSERT INTO duscussions_company_tags ( company_id, tags) VALUES (?, ?)` ;
            const data = [ company_id, strTags ];
            db.query(sql, data, (err, result) => {
                if (err) {
                    return res.send({
                        status: 'not ok',
                        message: 'Something went wrong '+err
                    });
                } else {
                    return res.send({
                        status: 'ok',
                        message: 'Your Discussion Tags Added Successfully'
                    });
                }
            })
        }
    })

}

//discussion company update tags
exports.updateCompanyTags = async (req, res) => {
    console.log('updateCompanyTags',req.body ); 
    //return false;
    const {  tags, company_id } = req.body;
    const strTags = JSON.stringify(tags);
    const sql = `UPDATE duscussions_company_tags SET tags = ? WHERE company_id = ? ` ;
    const data = [ strTags, company_id];
    db.query(sql, data, (err, result) => {
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Your Discussion Tag Deleted Successfully'
            });
        }
    })

}

//Notification Content
exports.notificationContent = async (req, res) => {
    //console.log('notificationContent',req.body ); 
    //console.log('notificationContent',req.file ); 
    //return false;
   
}
//compare Chart Filter
exports.compareChartFilter = async (req, res) => {
    console.log('compareChartFilter',req.body ); 
    const {company_id,company_name, from, to} = req.body
    
    const getCompanyReviewsBetween = await comFunction.getCompanyReviewsBetween(company_id, from, to)
    //console.log(getCompanyReviewsBetween)
    return res.send({
        status: 'ok',
        data:getCompanyReviewsBetween,
        company_name:company_name,
        message: 'Company Reviews Data fetch successfully '
    });
    //return false;
   
}

//historical Chart Filter
exports.historicalChartFilter = async (req, res) => {
    //console.log('historicalChartFilter', req.body);
    const { company_id, company_name, from, to, filter } = req.body;
  
    try {
      let getCompanyHistoricalData = await comFunction2.getCompanyHistoricalReviewBetween(company_id, from, to, filter);
  
      console.log('getCompanyHistoricalData', getCompanyHistoricalData);
  
      if (getCompanyHistoricalData.length === 0) {
        getCompanyHistoricalData = [{
            date_group: 0,
            created_at: '2023-01-01T03:09:07.000Z',
            average_rating: 0
          }]
      }
        return res.send({
            status: 'ok',
            data: getCompanyHistoricalData,
            filter:filter,
            company_name: company_name,
            message: 'Company Reviews Data fetch successfully '
          });
      
    } catch (error) {
      console.error('Error in historicalChartFilter:', error);
      return res.status(500).send({
        status: 'error',
        message: 'Internal Server Error'
      });
    }
  };

//historical Chart Filter
exports.competitorCompanyChart = async (req, res) => {
    console.log('competitorCompanyChart', req.body);
    const { company_id, company_name, competitor } = req.body;
    let competitorChartData = [];
  
    try {
        const ownCompanyData = await comFunction.getCompanyReviewsBetween(company_id);
        competitorChartData.push(ownCompanyData);

        let otherDataPromises = [];

        if (competitor != '') {
            if (Array.isArray(competitor)) {
                competitor.forEach((id) => {
                    otherDataPromises.push(comFunction.getCompanyReviewsBetween(id));
                });
            } else {
                otherDataPromises.push(comFunction.getCompanyReviewsBetween(competitor));
            }
        }

        const otherDataArray = await Promise.all(otherDataPromises);

        competitorChartData.push(...otherDataArray);

        console.log('competitorChartData', competitorChartData);

        return res.send({
            status: 'ok',
            data: competitorChartData,
            company_name: company_name,
            message: 'Company competitor Chart  Data fetch successfully'
        });
    } catch (error) {
        console.error('Error in competitor Chart Data:', error);
        return res.status(500).send({
            status: 'error',
            message: 'Internal Server Error'
        });
    }
};

//escalate to Next Level
exports.escalateNextLevel = async (req, res) => {
    console.log('escalateNextLevel', req.body);
    //return false;
    const { complaintId, customerId, levelId } = req.body;
    
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

    const sql = `SELECT c.*, clm.eta_days, clm.emails, u.first_name, u.email, comp.slug FROM 
    complaint c
    LEFT JOIN complaint_level_management clm ON clm.company_id = c.company_id AND clm.level = '${levelId + 1}'
    LEFT JOIN users u ON u.user_id = c.user_id 
    LEFT JOIN company comp ON comp.ID = c.company_id 
    WHERE c.id = '${complaintId}' `;
    const results = await query(sql);
    const emails = JSON.parse(results[0].emails);
    var mailOptions = {
        from: process.env.MAIL_USER,
        //to: 'pranab@scwebtech.com',
        to: results[0].email,
        cc:emails,
        subject: 'Escalate to next level email',
        html: `<div id="wrapper" dir="ltr" style="background-color: #f5f5f5; margin: 0; padding: 70px 0 70px 0; -webkit-text-size-adjust: none !important; width: 100%;">
        <table height="100%" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tbody>
          <tr>
            <td align="center" valign="top">
              <div id="template_header_image"><p style="margin-top: 0;"></p></div>
              <table id="template_container" style="box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important; background-color: #fdfdfd; border: 1px solid #dcdcdc; border-radius: 3px !important;" border="0" cellpadding="0" cellspacing="0" width="600">
              <tbody>
                <tr>
                  <td align="center" valign="top">
                    <!-- Header -->
                    <table id="template_header" style="background-color: #000; border-radius: 3px 3px 0 0 !important; color: #ffffff; border-bottom: 0; font-weight: bold; line-height: 100%; vertical-align: middle; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif;" border="0" cellpadding="0" cellspacing="0" width="600">
                      <tbody>
                        <tr>
                        <td><img alt="Logo" src="${process.env.MAIN_URL}assets/media/logos/email-template-logo.png"  style="padding: 30px 40px; display: block;  width: 70px;" /></td>
                        <td id="header_wrapper" style="padding: 36px 48px; display: block;">
                            <h1 style="color: #FCCB06; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 30px; font-weight: bold; line-height: 150%; margin: 0; text-align: left;">Escalate to next level email</h1>
                        </td>
    
                        </tr>
                      </tbody>
                    </table>
              <!-- End Header -->
              </td>
                </tr>
                <tr>
                  <td align="center" valign="top">
                    <!-- Body -->
                    <table id="template_body" border="0" cellpadding="0" cellspacing="0" width="600">
                      <tbody>
                        <tr>
                        <td id="body_content" style="background-color: #fdfdfd;" valign="top">
                          <!-- Content -->
                          <table border="0" cellpadding="20" cellspacing="0" width="100%">
                            <tbody>
                            <tr>
                              <td style="padding: 48px;" valign="top">
                                <div id="body_content_inner" style="color: #737373; font-family: &quot;Helvetica Neue&quot;, Helvetica, Roboto, Arial, sans-serif; font-size: 14px; line-height: 150%; text-align: left;">
                                
                                <table border="0" cellpadding="4" cellspacing="0" width="90%">
                                <tr>
                                  <td colspan="2">
                                    <strong>Hello Dear,</strong>
                                    <p style="font-size:15px; line-height:20px">Please review the complaint details and initiate the necessary steps to resolve the issue at the earliest. Your prompt attention to this matter is highly appreciated. Pending complaint ticket id: <a  href="${process.env.MAIN_URL}company-compnaint-details/${results[0].slug}/${results[0].id}">${results[0].ticket_id}</a>. 
                                    </p>
                                  </td>
                                </tr>
                                  <tr>
                                  </tr>
                                </table>
                                
                                </div>
                              </td>
                            </tr>
                            </tbody>
                          </table>
                        <!-- End Content -->
                        </td>
                        </tr>
                      </tbody>
                    </table>
                  <!-- End Body -->
                  </td>
                </tr>
                <tr>
                  <td align="center" valign="top">
                    <!-- Footer -->
                    <table id="template_footer" border="0" cellpadding="10" cellspacing="0" width="600">
                    <tbody>
                      <tr>
                      <td style="padding: 0; -webkit-border-radius: 6px;" valign="top">
                        <table border="0" cellpadding="10" cellspacing="0" width="100%">
                          <tbody>
                            <tr>
                            <td colspan="2" id="credit" style="padding: 20px 10px 20px 10px; -webkit-border-radius: 0px; border: 0; color: #fff; font-family: Arial; font-size: 12px; line-height: 125%; text-align: center; background:#000" valign="middle">
                                  <p>This email was sent from <a style="color:#FCCB06" href="${process.env.MAIN_URL}">BoloGrahak</a></p>
                            </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      </tr>
                    </tbody>
                    </table>
                  <!-- End Footer -->
                  </td>
                </tr>
              </tbody>
              </table>
            </td>
          </tr>
          </tbody>
        </table>
        </div>`
      }
    await  mdlconfig.transporter.sendMail(mailOptions, function (err, info) {
          if (err) {
              console.log(err);
              return false;
          } else {
              console.log('Mail Send: ', info.response);
              
          }
      })
  
    try {
      
        const updateQuery = `UPDATE complaint SET level_id= '${levelId + 1}', level_update_at ='${formattedDate}'  WHERE id = '${complaintId}' `;
        db.query(updateQuery, (err, resut)=>{
            if (err) {
                return res.send({
                    status: 'not ok',
                    message: 'Something went wrong '+err
                });
            } else {
                return res.send({
                    status: 'ok',
                    message: 'Complaint level escalate to next level successfully.'
                  });
            }
        })
    } catch (error) {
      console.error('Error in escalateNextLevel:', error);
      return res.status(500).send({
        status: 'error',
        message: 'Internal Server Error'
      });
    }
  };

//add payment details
exports.addPayment =  (req, res) => {
    //console.log('addPayment',req.body);
    //return false;
    const {company_id, transaction_id, payment_mode, amount, transaction_date, membership_plan, remarks, subscription_mode, start_date, expire_date } = req.body;
    //return false;
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const data = {
        transaction_id:transaction_id || null,
        company_id :company_id,
        mode_of_payment:payment_mode,
        amount:amount,
        transaction_date : transaction_date,
        membership_plan_id:membership_plan,
        remarks:remarks,
        subscription_mode:subscription_mode,
        start_date:start_date,
        expire_date:expire_date,
        created_at:formattedDate,
        updated_at:formattedDate,
    }

    
   // console.log(complaintEmailToCompany);
    const Query = `INSERT INTO payments SET ?  `;
    db.query(Query, data, async (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong  '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Payment details registered  successfully !'
            });
        }
    })
}

//Edit payment details
exports.editPayment =  (req, res) => {
    //console.log('editPayment',req.body);
    //return false;
    const {company_id, transaction_id, payment_mode, amount, transaction_date, membership_plan, remarks, subscription_mode, start_date, expire_date, payment_id } = req.body;
    //return false;
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
    const data = {
        transaction_id:transaction_id || null,
        company_id :company_id,
        mode_of_payment:payment_mode,
        amount:amount,
        transaction_date : transaction_date,
        membership_plan_id:membership_plan,
        remarks:remarks,
        subscription_mode:subscription_mode,
        start_date:start_date,
        expire_date:expire_date,
        updated_at:formattedDate,
    }

    
   // console.log(complaintEmailToCompany);
    const Query = `UPDATE payments  SET ? WHERE id = ${payment_id} `;
    db.query(Query, data, async (err, result)=>{
        if (err) {
            return res.send({
                status: 'not ok',
                message: 'Something went wrong  '+err
            });
        } else {
            return res.send({
                status: 'ok',
                message: 'Payment details updated  successfully !'
            });
        }
    })
}


// Schedule mail for pending complaint
cron.schedule('0 10 * * *', async () => {
    //console.log('running a task every minute');
    const sql = `SELECT complaint.* ,u.email , clm.emails, clm.eta_days, cc.category_name, subcat.category_name AS sub_category_name
    FROM complaint 
    LEFT JOIN  complaint_level_management clm ON complaint.level_id = clm.level AND  complaint.company_id = clm.company_id
    LEFT JOIN complaint_category cc ON complaint.category_id = cc.id 
    LEFT JOIN complaint_category subcat ON complaint.sub_cat_id = subcat.id 
    LEFT JOIN company_claim_request ccr ON ccr.company_id = complaint.company_id 
    LEFT JOIN users u ON u.user_id = ccr.claimed_by
    WHERE complaint.status != '1' `
    const results =await query(sql);
    //console.log(results);
    if (results.length > 0) {
        results.forEach(async (result)=>{
            let emailArr = []; 
            if(result.emails){
                emailArr = JSON.parse(result.emails); 
            }
            
            await comFunction2.complaintScheduleEmail(emailArr,result);

                // emailArr.forEach(async (email)=>{
                //     await comFunction2.complaintScheduleEmail(email,result);
                // })
        })
    }
});

//Discussion customer query alert
cron.schedule('0 5 * * *', async () => {
    await comFunction2.duscussionQueryAlert();
    await comFunction2.complaintLevelUpdate();
})