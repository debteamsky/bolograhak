const util = require('util');
const db = require('./config');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const useragent = require('useragent');
const requestIp = require('request-ip');
const axios = require('axios');
const { cache } = require('ejs');
const comFunction2 = require('./common_function2');

dotenv.config({ path: './.env' });
const query = util.promisify(db.query).bind(db);
// Fetch user details from the users table
function getUser(userId) {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM users WHERE user_id = ?', [userId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result[0]);
      }
    });
  });
}

// Function to fetch user metadata from the user_customer_meta table
function getUserMeta(userId) {
  return new Promise((resolve, reject) => {
    const user_meta_query = `
            SELECT user_meta.*, c.name as country_name, s.name as state_name, ccr.company_id as claimed_comp_id, company.paid_status as payment_status, company.slug, mp.plan_name
            FROM user_customer_meta user_meta
            LEFT JOIN countries c ON user_meta.country = c.id
            LEFT JOIN states s ON user_meta.state = s.id
            LEFT JOIN company_claim_request ccr ON user_meta.user_id = ccr.claimed_by
            LEFT JOIN company ON company.ID = ccr.company_id
            LEFT JOIN membership_plans mp ON company.membership_type_id = mp.id
            WHERE user_meta.user_id = ?
        `;
    db.query(user_meta_query, [userId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result[0]);
      }
    });
  });
}

async function getUsersByRole(roleID){
  const get_users_query = `
    SELECT ur.*, ccr.company_id, ccr.status
    FROM users ur
    LEFT JOIN company_claim_request ccr ON ur.user_id = ccr.claimed_by
    WHERE ur.user_type_id = ? AND ur.user_status = "1"`;
  const get_users_value = [roleID];
  try{
    const get_users_result = await query(get_users_query, get_users_value);
    return get_users_result;
  }catch(error){
    return 'Error during user get_company_rewiew_query:'+error;
  }
}

// Fetch all countries
function getCountries() {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM countries', (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Fetch user role from user_account_type table data
function getUserRoles() {
  return new Promise((resolve, reject) => {
    db.query('SELECT * FROM user_account_type', (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Fetch user all states by country
function getStatesByUserID(userId) {
  return new Promise((resolve, reject) => {
    db.query('SELECT country FROM user_customer_meta WHERE user_id = ?', [userId], async (err, result) => {
      console.log(result);
      if (err) {
        reject(err);
      }else if(result[0].country == null || result[0].country == undefined ){
        resolve([]);
      } else {
        //console.log('Result:', result); // Log the result array
        if (result && result.length > 0) {
          //console.log(result[0].country);
          let countryID = '';
          if(result[0].country==null){
            countryID = 101;
          }else{
            countryID = result[0].country;
          }
          const userCountryId = countryID.toString();
          db.query('SELECT * FROM states WHERE country_id = ?', [userCountryId], async (err, results) => {
            if (err) {
              reject(err);
            } else {
              resolve(results);
            }
          });
        } else {
          reject(new Error('User country not found'));
        }
      }
    });
  });
}

// Fetch all Company
function getAllCompany() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT c.*, GROUP_CONCAT(cat.category_name) AS categories
      FROM company c
      LEFT JOIN company_cactgory_relation cr ON c.ID = cr.company_id
      LEFT JOIN category cat ON cr.category_id = cat.ID
      WHERE c.status != '3'
      GROUP BY c.ID`,
      async(err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// Fetch all trashed Company
function getAllTrashedCompany() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT c.*, GROUP_CONCAT(cat.category_name) AS categories
      FROM company c
      LEFT JOIN company_cactgory_relation cr ON c.ID = cr.company_id
      LEFT JOIN category cat ON cr.category_id = cat.ID
      WHERE c.status = '3'
      GROUP BY c.ID`,
      async(err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function getCompany(companyId) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT company.*, ccr.claimed_by, mp.plan_name as membership_plan_name
              FROM company 
              LEFT JOIN company_claim_request ccr ON company.ID = ccr.company_id
              LEFT JOIN membership_plans mp ON company.membership_type_id = mp.id
              WHERE company.ID = ?`
    db.query(sql, [companyId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result[0]);
      }
    });
  });
}

async function getCompanyCategory() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE
    });

    const [categories] = await connection.query('SELECT * FROM category');
    //console.log(categories);
    connection.end();
    const nestedCategories = buildCategoryTree(categories);   // This is the Json Format Of All Categories
    const nestedCategoriesHTML = renderCategoryTreeHTML(nestedCategories);

    return nestedCategoriesHTML;
  } catch (error) {
    throw new Error('Error fetching company categories');
  }
}

function buildCategoryTree(categories, parentId = 0) {
  const categoryTree = [];

  categories.forEach((category) => {
    if (category.parent_id === parentId) {
      const children = buildCategoryTree(categories, category.ID);
      const categoryNode = { id: category.ID, name: category.category_name, img: category.category_img, children };
      categoryTree.push(categoryNode);
    }
  });

  return categoryTree;
}

function renderCategoryTreeHTML(categories) {
  let html = '<ul>';
  categories.forEach(function (category) {
    html += '<li class="mt-5"><div class="mb-5"><div class="form-check"><input type="checkbox" name="category" class="form-check-input" value="' + category.id + '"><label class="form-check-label" for="flexCheckDefault">' + category.name + '</label>';
    if (category.children.length > 0) {
      html += renderCategoryTreeHTML(category.children);
    }
    html += '</div></div></li>';
  });
  html += '</ul>';
  return html;
}

async function getCompanyCategoryBuID(compID) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE
    });

    const [categories] = await connection.query('SELECT * FROM category');

    const [com_categories] = await connection.query('SELECT category_id FROM company_cactgory_relation WHERE company_id = ?', [compID]);

    const com_category_array = com_categories.map((category) => category.category_id);

    //console.log(com_category_array);
    connection.end();
    const nestedCategories = buildCategoryTree(categories);   // This is the Json Format Of All Categories
    const nestedCategoriesHTMLwithChecked = renderCategoryTreeHTMLforCompany(nestedCategories, com_category_array);

    return nestedCategoriesHTMLwithChecked;
  } catch (error) {
    throw new Error('Error fetching company categories');
  }
}

function renderCategoryTreeHTMLforCompany(categories, com_category_array) {
  let html = '<ul>';
  categories.forEach(function (category) {
    if (com_category_array.includes(category.id)) {
      var inputchecked = 'checked';
    } else {
      var inputchecked = '';
    }
    html += '<li class="mt-5"><div class="mb-5"><div class="form-check"><input type="checkbox" name="category" class="form-check-input" value="' + category.id + '" ' + inputchecked + '><label class="form-check-label" for="flexCheckDefault">' + category.name + '</label>';
    if (category.children.length > 0) {
      html += renderCategoryTreeHTMLforCompany(category.children, com_category_array);
    }
    html += '</div></div></li>';
  });
  html += '</ul>';
  return html;
}

//-------After Google Login Save User data Or Check User exist or Not.
async function saveUserGoogleLoginDataToDB(userData) {
  //console.log(userData);

  const userFullName = userData.displayName;
  const userFullNameArray = userFullName.split(" ");
  const userFirstName = userData.name.givenName;
  const userLastName = userData.name.familyName;
  const userEmail = userData.emails[0].value;
  const userPicture = userData.photos[0].value;
  const external_registration_id = userData.id;
  

  //Checking external_registration_id and Email exist or not
  try{
    // const user_exist_query = 'SELECT * FROM users WHERE register_from = ? AND external_registration_id = ? AND email = ?';
    // const user_exist_values = ["gmail", userData.id, userData.emails[0].value];
    const user_exist_query = 'SELECT * FROM users WHERE email = ?';
    const user_exist_values = [userData.emails[0].value];
    const user_exist_results = await query(user_exist_query, user_exist_values);
    if (user_exist_results.length > 0) {
        //console.log(user_exist_results);
        // checking user status
      return {user_id: user_exist_results[0].user_id, first_name:userFirstName, last_name:userLastName, email: userEmail, profile_pic: userPicture, status: 1, register_from:user_exist_results[0].register_from};

    }else{
      return {first_name:userFirstName, last_name:userLastName, email: userEmail, profile_pic: userPicture, external_registration_id: external_registration_id, status: 0};
    }
  }catch(error){
      console.error('Error during user_exist_query:', error);
  }      

};

//-------After Facebook Login Save User data Or Check User exist or Not.
async function saveUserFacebookLoginDataToDB(userData) {
  //console.log(userData);
  //console.log(userData.id + ' ' + userData.displayName + ' ' + userData.photos[0].value);
  //const currentDate = new Date();
  //const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

  const userFullName = userData.displayName;
  const userFullNameArray = userFullName.split(" ");
  const userFirstName = userData.name.givenName;
  const userLastName = userData.name.familyName;
  const userEmail = userData.emails[0].value;
  const userPicture = userData.photos[0].value;
  const external_registration_id = userData.id;
  

  //Checking external_registration_id and Email exist or not
  try{
    //const user_exist_query = 'SELECT * FROM users WHERE register_from = ? AND external_registration_id = ? AND email = ?';
    //const user_exist_values = ["facebook", userData.id, userData.emails[0].value];
    const user_exist_query = 'SELECT * FROM users WHERE email = ?';
    const user_exist_values = [userData.emails[0].value];
    const user_exist_results = await query(user_exist_query, user_exist_values);
    if (user_exist_results.length > 0) {
        //console.log(user_exist_results);
        // checking user status
      return {user_id: user_exist_results[0].user_id, first_name:userFirstName, last_name:userLastName, email: userEmail, profile_pic: userPicture, status: 1, register_from:user_exist_results[0].register_from};

    }else{
      return {first_name:userFirstName, last_name:userLastName, email: userEmail, profile_pic: userPicture, external_registration_id: external_registration_id, status: 0};
    }
  }catch(error){
      console.error('Error during user_exist_query:', error);
  }      

};

// Fetch all Review Rating Tags
function getAllRatingTags() {
  return new Promise((resolve, reject) => {
      db.query('SELECT * FROM review_rating_tags', (err, result) => {
          if (err) {
              reject(err);
          } else {
              resolve(result);
          }
      });
  });
}

function getReviewRatingData(review_rating_Id) {
  return new Promise((resolve, reject) => {
      db.query('SELECT * FROM review_rating_tags WHERE id = ?', [review_rating_Id], (err, result) => {
          if (err) {
              reject(err);
          } else {
              resolve(result[0]);
          }
      });
  });
}

async function getAllReviews() {
  const all_review_query = `
    SELECT r.*, c.company_name, c.logo, c.status as company_status, c.verified as verified_status, cl.address, cl.country, cl.state, cl.city, cl.zip, u.first_name, u.last_name, ucm.profile_pic, rr.status as reply_status
      FROM reviews r
      JOIN company c ON r.company_id = c.ID
      JOIN company_location cl ON r.company_location_id = cl.ID
      JOIN users u ON r.customer_id = u.user_id
      LEFT JOIN user_customer_meta ucm ON u.user_id = ucm.user_id
      LEFT JOIN review_reply rr ON rr.review_id = r.id AND rr.reply_by = r.customer_id
      WHERE r.flag_status = '0' OR r.flag_status IS NULL
      ORDER BY r.created_at DESC;
  `;
  try{
    const all_review_results = await query(all_review_query);
    return all_review_results;
  }
  catch(error){
    console.error('Error during all_review_query:', error);
  }
}

async function getAllReviewsByCompanyID(companyId) {
  const all_review_query = `
  SELECT r.*, c.company_name, c.slug, c.logo, c.status as company_status, c.verified as verified_status, cl.address, cl.country, cl.state, cl.city, cl.zip, u.first_name, u.last_name, ucm.profile_pic, count(rr.ID) as reply_count, cp.product_title 
  FROM reviews r
  JOIN company c ON r.company_id = c.ID
  JOIN company_location cl ON r.company_location_id = cl.ID
  JOIN users u ON r.customer_id = u.user_id
  LEFT JOIN user_customer_meta ucm ON u.user_id = ucm.user_id
  LEFT JOIN review_reply rr ON r.id = rr.review_id
  LEFT JOIN company_products cp ON r.product_id = cp.id 
  WHERE r.company_id = ? AND r.review_status = '1' AND (r.flag_status != '0' OR r.flag_status IS NULL)
  GROUP BY r.id
  ORDER BY r.created_at DESC;
  `;
  try{
    const all_review_results = await query(all_review_query, companyId);
    if (all_review_results.length > 0) {
      return all_review_results;
    } else {
      return [];
    }
  }
  catch(error){
    console.error('Error during all_review_query:', error);
  }
}

async function getCustomerReviewData(review_Id){
  const select_review_query = `
    SELECT r.*, c.company_name, c.slug, c.logo, c.status as company_status, c.verified as verified_status, cl.address, cl.country, cl.state, cl.city, cl.zip, u.first_name, u.last_name, ucm.profile_pic,rr.ID as reply_id, rr.status as reply_status, rr.reason as reply_rejecting_reason, rr.comment as reply_content, rrCompany.comment as company_reply_content, cc.category_name, cp.product_title  
      FROM reviews r
      JOIN company c ON r.company_id = c.ID
      JOIN company_location cl ON r.company_location_id = cl.ID
      JOIN users u ON r.customer_id = u.user_id
      LEFT JOIN user_customer_meta ucm ON u.user_id = ucm.user_id
      LEFT JOIN review_reply rr ON rr.review_id = r.id AND rr.reply_by = r.customer_id
      LEFT JOIN review_reply rrCompany ON rrCompany.review_id = r.id AND rrCompany.reply_by != r.customer_id
      LEFT JOIN complaint_category cc ON r.category_id = cc.id 
      LEFT JOIN company_products cp ON r.product_id = cp.id 
      WHERE r.id = ?;
  `;
  const select_review_value = [review_Id];
  try{
    const select_review_results = await query(select_review_query, select_review_value);
    return select_review_results[0];
  }
  catch(error){
    console.error('Error during select_review_query:', error);
  }
}

async function getCustomerReviewTagRelationData(review_Id){
  const select_review_tag_query = `
    SELECT r.id as review_id, rtr.id, rtr.tag_name
      FROM reviews r
      JOIN review_tag_relation rtr ON r.id = rtr.review_id
      WHERE r.id = ?;
  `;
  const select_review_tag_value = [review_Id];
  try{
    const select_review_tag_results = await query(select_review_tag_query, select_review_tag_value);
    return select_review_tag_results;
  }
  catch(error){
    console.error('Error during select_review_tag_query:', error);
  }
}

function getMetaValue(pageID, page_meta_key) {
  //console.log(pageID + ' ' + page_meta_key);
  db.query(`SELECT page_meta_value FROM page_meta  WHERE page_id  = ${pageID} AND  page_meta_key  =  '${page_meta_key}' `, async (err, result) => {
    if (err) {
      //reject(err);
      console.log(err)
    } else {
      //console.log('Result:', result); // Log the result array
      if (result && result.length > 0) {
        const meta_values = result[0];
        return result;
      }
    }
  });

}

// Function to insert data into 'faq_pages' table
async function insertIntoFaqPages(data) {
  try {
    const checkQuery = `SELECT * FROM faq_pages WHERE 1`;
    db.query(checkQuery, async (checkErr, checkResult) => {
      if (checkResult.length > 0) {
        const updateQuery = `UPDATE faq_pages SET title=?, content = ?, meta_title = ?, meta_desc = ?, keyword = ?, app_banner_content = ? WHERE id = ${checkResult[0].id}`;
        const results = await query(updateQuery, data);
        return checkResult[0].id;
      } else {
        const insertQuery = 'INSERT INTO faq_pages (title, content, meta_title, meta_desc, keyword, app_banner_content) VALUES (?, ?, ?, ?, ?, ?)';
        const results = await query(insertQuery, data);
        return results.insertId;
      }
    })


  } catch (error) {
    console.error('Error inserting data into faq_pages table:', error);
    throw error;
  }
}

// Function to insert data into 'faq_categories' table
async function insertIntoFaqCategories(categoryArray) {
  if (Array.isArray(categoryArray) && categoryArray.length > 0) {
    for (const categoryData of categoryArray) {

      try {
        const categoryTitle = Object.keys(categoryData)[0];
        const CatinsertQuery = `INSERT INTO faq_categories (category) VALUES (?)`;
        const Catinsertvalues = [categoryTitle];
        const results = await query(CatinsertQuery, Catinsertvalues);
        const categoryId = results.insertId;
        console.log('Data inserted into faq_categories table:', categoryId);

        // Insert data into 'faq_item' table for the current category
        if (categoryData[categoryTitle].length > 0) {
          await insertIntoFaqItems(categoryData[categoryTitle], categoryId);
        }
      } catch (error) {
        console.error('Error inserting data into faq_categories table:', error);
        throw error;
      }
    }
  }
}

// Function to insert data into 'faq_item' table
async function insertIntoFaqItems(faqItemsArray, categoryId) {
  if (Array.isArray(faqItemsArray) && faqItemsArray.length > 0) {
    for (const faqItemData of faqItemsArray) {
      try {
        const FAQItenInsertquery = `INSERT INTO faq_item (category_id, question, answer) VALUES (?, ?, ?)`;
        const FAQItenInsertvalues = [categoryId, faqItemData.Q, faqItemData.A];

        const results = await query(FAQItenInsertquery, FAQItenInsertvalues);
        console.log('Data inserted into faq_item table:', results.insertId);
      } catch (error) {
        console.error('Error inserting data into faq_item table:', error);
        throw error;
      }
    }
  }
}

//-- Create New Company ----------//
async function createCompany(comInfo, userId) {
  //console.log(comInfo, userId);
  let return_data = {};
  try {
    // Check if the company Name already exists in the "company" table
    const company_name_checking_query = "SELECT ID FROM company WHERE company_name = ?";
    const company_name_checking_results = await query(company_name_checking_query, [comInfo.company_name]);
    if (company_name_checking_results.length > 0) {
        //company exist
        try{
          const company_address_exist_query = 'SELECT * FROM company_location WHERE company_id = ? AND address = ?';
          const company_address_exist_values = [company_name_checking_results[0].ID, comInfo.address];
          const company_address_exist_results = await query(company_address_exist_query, company_address_exist_values);
          if (company_address_exist_results.length > 0) {
            //address exist return location ID
            return_data.companyID = company_name_checking_results[0].ID;
            return_data.companyLocationID = company_address_exist_results[0].ID;
            return return_data;
          }else{
            //create new address for company
            try{
              const create_company_address_query = 'INSERT INTO company_location (company_id, address, country, state, city, zip, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
              const create_company_address_values = [company_name_checking_results[0].ID, comInfo.address, '', '', '', '', '2'];
              const create_company_address_results = await query(create_company_address_query, create_company_address_values);
              if (create_company_address_results.insertId) {
                return_data.companyID = company_name_checking_results[0].ID;
                return_data.companyLocationID = create_company_address_results.insertId;
                return return_data;
              }
            }catch(error){
              console.error('Error during create_company_address_query:', error);
              return error;
            }
                        
          }
        }catch(error){
            console.error('Error during company_address_exist_query:', error);
            return error;
        }        
        //return company_name_checking_results[0].ID;
    }else{
      // Create New Company
      // Get the current date
      const currentDate = new Date();

      // Format the date in 'YYYY-MM-DD HH:mm:ss' format (adjust the format as needed)
      const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
      try {
        const companySlug = await new Promise((resolve, reject) => {
          comFunction2.generateUniqueSlug(comInfo.company_name, (error, generatedSlug) => {
            if (error) {
              console.log('Error:', error.message);
              reject(error);
            } else {
              //console.log('Generated Company Slug:', generatedSlug);
              resolve(generatedSlug);
            }
          });
        });

        //console.log('Outside of Callback - Company Slug:', companySlug);
        //return false;
        const companyInsertData = {
          user_created_by : userId,
          company_name: comInfo.company_name || null,
          status: '2',
          created_date: formattedDate,
          updated_date: formattedDate,
          main_address: comInfo.address || null,
          verified: '0',
          slug: companySlug,
        };
        const create_company_query = 'INSERT INTO company SET ?'
        const create_company_results = await query(create_company_query, companyInsertData);
        
        if (create_company_results.insertId) {
          //create new address for company
          try{
            const create_company_address_values = {
              company_id : create_company_results.insertId,
              address: comInfo.address || null,
              status: '2',
            };
            const create_company_address_query = 'INSERT INTO company_location SET ?'
            const create_company_address_results = await query(create_company_address_query, create_company_address_values);

            if (create_company_address_results.insertId) {
              return_data.companyID = create_company_results.insertId;
              return_data.companyLocationID = create_company_address_results.insertId;
              console.log('return_data',return_data)
              return return_data;
            }else{
              return_data.companyID = create_company_results.insertId;
              return_data.companyLocationID = '';
              console.log('return_data.companyLocationID:',return_data)
              return return_data;
            }
          }catch(error){
            console.error('Error during create_company_address_query:', error);
            return error;
          }
        }else{
          return [];
        }
        
      }catch(error){
        console.error('Error during user create_company_query:', error);
        return error;
      }
    }
  }
  catch (error) {
    console.error('Error during user company_name_checking_query:', error);
  }
};

async function createReview(reviewIfo, userId, comInfo){
  // console.log('Review Info', reviewIfo);
  // console.log('Company Info', comInfo);
  // reviewIfo['tags[]'].forEach((tag) => {
  //   console.log(tag);
  // });
  if (typeof reviewIfo['tags[]'] === 'string') {
    // Convert it to an array containing a single element
    reviewIfo['tags[]'] = [reviewIfo['tags[]']];
  }
  const currentDate = new Date();
  // Format the date in 'YYYY-MM-DD HH:mm:ss' format (adjust the format as needed)
  const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

  const create_review_query = 'INSERT INTO reviews (company_id, customer_id, company_location, company_location_id, review_title, rating, review_content, user_privacy, review_status, created_at, updated_at, labels, user_contact, category_id, product_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const create_review_values = [comInfo.companyID, userId, reviewIfo.address, comInfo.companyLocationID, reviewIfo.review_title, reviewIfo.rating, reviewIfo.review_content, reviewIfo.user_privacy, '2', formattedDate, formattedDate, reviewIfo.review_lable, reviewIfo.user_contact, reviewIfo.category_id, reviewIfo.product_id  ];
              
  try {
    const create_review_results = await query(create_review_query, create_review_values);
    if(create_review_results.insertId){
      if (Array.isArray(reviewIfo['tags[]']) && reviewIfo['tags[]'].length > 0) {
        //insert review_tag_relation
        const review_tag_relation_query = 'INSERT INTO review_tag_relation (review_id, tag_name) VALUES (?, ?)';
        try{
          for (const tag of reviewIfo['tags[]']) {
            const review_tag_relation_values = [create_review_results.insertId, tag];
            const review_tag_relation_results = await query(review_tag_relation_query, review_tag_relation_values);
          }

          //-- user review count------//
          const update_review_count_query = 'UPDATE user_customer_meta SET review_count = review_count + 1 WHERE user_id = ?';
          try {
            const [update_review_count_result] = await db.promise().query(update_review_count_query, [userId]);
            return create_review_results.insertId;
          }catch (error) {
            console.error('Error during user update_review_count_query:', error);
          }
          
        }catch(error){
          console.error('Error during user review_tag_relation_results:', error);
        }
      }else{
        //-- user review count------//
        const update_review_count_query = 'UPDATE user_customer_meta SET review_count = review_count + 1 WHERE user_id = ?';
        try {
          const [update_review_count_result] = await db.promise().query(update_review_count_query, [userId]);
          return create_review_results.insertId;
        }catch (error) {
          console.error('Error during user update_review_count_query:', error);
        }
      }
    }
  }catch (error) {
    console.error('Error during user create_review_results:', error);
  }
}

async function getlatestReviews(reviewCount){
  const get_latest_review_query = `
    SELECT r.*, c.company_name, c.logo, cl.address, cl.country, cl.state, cl.city, cl.zip
      FROM reviews r
      JOIN company c ON r.company_id = c.ID AND c.status = "1"
      JOIN company_location cl ON r.company_location_id = cl.ID AND cl.status = "1"
      WHERE r.review_status = "1"
      ORDER BY r.created_at DESC
      LIMIT ${reviewCount};
  `;
  try{
    const get_latest_review_results = await query(get_latest_review_query);
    if(get_latest_review_results.length > 0 ){
      //console.log(get_latest_review_results);
      return get_latest_review_results;
    }else{
      return [];
    }
  }catch(error){
    console.error('Error during user get_latest_review_query:', error);
  }
  
}

async function editCustomerReview(req){
  //console.log(req)
  let ratingTagsArray = '';
  if(req.rating_tags){
    ratingTagsArray = JSON.parse(req.rating_tags);
  }
  const currentDate = new Date();
  // Format the date in 'YYYY-MM-DD HH:mm:ss' format (adjust the format as needed)
  const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

  const update_review_values = [
    req.update_company_id ? req.update_company_id : req.company_id,
    req.company_location || null,
    req.review_title || null,
    req.rating,
    req.review_content,
    req.user_privacy,
    req.review_status,
    req.review_rejecting_comment || null,
    formattedDate,
    req.user_contact,
    req.category_id,
    req.product_id,
    req.review_id,
  ];
  const update_review_query =
    'UPDATE reviews SET ' +
    'company_id = ?, ' +
    'company_location = ?, ' +
    'review_title = ?, ' +
    'rating = ?, ' +
    'review_content = ?, ' +
    'user_privacy = ?, ' +
    'review_status = ?, ' +
    'rejecting_reason = ?, ' +
    'updated_at = ?, ' +
    'user_contact = ?, ' +
    'category_id = ?, ' +
    'product_id = ? ' +
    'WHERE id = ?';

  console.log(update_review_query);
  try {
    const update_review_result = await query(update_review_query, update_review_values);
    //console.log(update_review_result );
      // Remove all tags for the review
      const delete_tag_relation_query = 'DELETE FROM review_tag_relation WHERE review_id = ?';
      const delete_tag_relation_values = [req.review_id];
      try {
        const delete_tag_relation_result = await query(delete_tag_relation_query, delete_tag_relation_values);
        console.log('Review deleted:', delete_tag_relation_result);
      } catch (error) {
        return 'Error during review delete_tag_relation_query:'+error;
      }

      //insert review_tag_relation
      if (ratingTagsArray && ratingTagsArray.length > 0) {
        const insert_tag_relation_query = 'INSERT INTO review_tag_relation (review_id, tag_name) VALUES (?, ?)';
        for (const tag of ratingTagsArray) {
          const insert_tag_relation_values = [req.review_id, tag.value];
          try {
            const insert_tag_relation_result = await query(insert_tag_relation_query, insert_tag_relation_values);
            //console.log('New tag relation inserted:', insert_tag_relation_result);
          } catch (error) {
            return 'Error during insert_tag_relation_query:'+error;
          }
        }
      }
      return true;
  }catch (error) {
    return 'Error during user update_review_query:'+error;
  }  
}

async function searchCompany(keyword){
  const get_company_query = `
    SELECT ID, company_name, logo, about_company, slug, main_address, main_address_pin_code FROM company
    WHERE company_name LIKE '%${keyword}%' AND status = '1'
    ORDER BY created_date DESC
  `;
  try{
    const get_company_results = await query(get_company_query);
    if(get_company_results.length > 0 ){
      console.log(get_company_results);
      return {status: 'ok', data: get_company_results, message: get_company_results.length+' company data recived'};
    }else{
      return {status: 'ok', data: '', message: 'No company data found'};
    }
  }catch(error){
    return {status: 'err', data: '', message: 'No company data found'};
  }  
}

async function getCompanyReviewNumbers(companyID){
  const get_company_rewiew_count_query = `
    SELECT COUNT(*) AS total_review_count, AVG(rating) AS total_review_average
    FROM reviews
    WHERE company_id = ? AND review_status = ?`;
  const get_company_rewiew_count_value = [companyID, '1'];
  try{
    const get_company_rewiew_count_result = await query(get_company_rewiew_count_query, get_company_rewiew_count_value);
    const get_company_rewiew_rating_count_query = `
    SELECT rating,count(rating) AS cnt_rat, created_at
    FROM reviews
    WHERE company_id = ? AND review_status = '1'
    group by rating ORDER by rating DESC`;
    try{
      const get_company_rewiew_rating_count_result = await query(get_company_rewiew_rating_count_query, get_company_rewiew_count_value);
      return {rewiew_count:get_company_rewiew_count_result[0], rewiew_rating_count: get_company_rewiew_rating_count_result};
    }catch(error){
      return 'Error during user get_company_rewiew_rating_count_query:'+error;
    }
    
  }catch(error){
    return 'Error during user get_company_rewiew_count_query:'+error;
  }
}
function getDefaultFromDate() {
  const currentDate = new Date();
  return currentDate.toISOString().split('T')[0]; // Returns current date in 'YYYY-MM-DD' format
}

function getDefaultToDate() {
  const currentDate = new Date();
  const sevenDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return sevenDaysAgo.toISOString().split('T')[0]; // Returns date 30 days ago in 'YYYY-MM-DD' format
}

async function getCompanyReviewsBetween(companyID, from = getDefaultFromDate(), to = getDefaultToDate()){

  const get_company_total_rewiew_count_query = `
    SELECT COUNT(*) AS total_review_count, AVG(rating) AS total_review_average
    FROM reviews
    WHERE company_id = ? AND review_status = ?`;
  const get_company_total_rewiew_count_value = [companyID, '1'];
  const get_company_total_rewiew_rating_result = await query(get_company_total_rewiew_count_query, get_company_total_rewiew_count_value);

  const get_company_rewiew_count_query = `
    SELECT COUNT(*) AS filter_review_count, AVG(rating) AS filter_review_average
    FROM reviews
    WHERE company_id = ? AND review_status = ? 
    AND created_at BETWEEN ? AND ?`;
  const get_company_rewiew_count_value = [companyID, '1', from, to];;
  try{
    const get_company_rewiew_rating_count_result = await query(get_company_rewiew_count_query, get_company_rewiew_count_value);
    const mergedResult = {
      ...get_company_total_rewiew_rating_result[0],
      ...get_company_rewiew_rating_count_result[0]
    };
      //console.log(mergedResult)
      return mergedResult;
    }catch(error){
      return 'Error during user get_company_rewiew_rating_count_query:'+error;
    }
  
}

async function getCompanyReviews(companyID){
  const get_company_reviews_query = `
    SELECT r.*, ur.first_name, ur.last_name, ur.email, ucm.profile_pic,
           rr.ID AS reply_id, rr.reply_by AS reply_by, rr.comment AS reply_comment , rr.created_at AS reply_created_at, rr.status AS reply_status
    FROM reviews r
    JOIN users ur ON r.customer_id = ur.user_id
    LEFT JOIN user_customer_meta ucm ON ur.user_id = ucm.user_id
    LEFT JOIN review_reply rr ON r.id = rr.review_id 
    WHERE r.company_id = ? AND r.review_status = "1" AND (r.flag_status != '0' OR r.flag_status IS NULL)
    ORDER BY r.created_at DESC, rr.created_at ASC
    LIMIT 20`;
  const get_company_reviews_values = [companyID];
  try {
    const get_company_reviews_result = await query(get_company_reviews_query, get_company_reviews_values);

    const reviewsMap = new Map(); // Map to group reviews and their replies

    for (const row of get_company_reviews_result) {
      if (!reviewsMap.has(row.id)) {
        reviewsMap.set(row.id, {
          ...row,
          review_reply: [] // Initialize an empty array for review replies
        });
      }

      if (row.reply_id) {
        reviewsMap.get(row.id).review_reply.push({
          ID: row.reply_id,
          review_id: row.id,
          reply_by: row.reply_by,
          comment: row.reply_comment,
          status: row.reply_status,
          created_at: row.reply_created_at
        });
      }
    }

    const finalResult = Array.from(reviewsMap.values());

    return finalResult;
  } catch (error) {
    return 'Error during user get_company_reviews_query:' + error;
  }
}

async function getReviewByID(reviewId){
  const get_single_rewiew_query = `
    SELECT r.*, ur.first_name, ur.last_name, ur.email, ucm.profile_pic, ccreq.claimed_by as company_owner
    FROM reviews r
    JOIN users ur ON r.customer_id = ur.user_id
    LEFT JOIN user_customer_meta ucm ON ur.user_id = ucm.user_id
    LEFT JOIN company_claim_request ccreq ON r.company_id = ccreq.company_id
    WHERE r.id = ?`;
  const get_single_rewiew_value = [reviewId];
  try{
    const get_single_rewiew_result = await query(get_single_rewiew_query, get_single_rewiew_value);
    return get_single_rewiew_result;
    console.log('aaa',get_single_rewiew_result);
  }catch(error){
    return 'Error during user get_single_rewiew_query:'+error;
  }
}

async function getReviewReplyDataByID(reviewId){
  const get_single_rewiew_reply_query = `
    SELECT rpy.*, ur.first_name, ur.last_name, ur.email, ucm.profile_pic
    FROM review_reply rpy
    JOIN users ur ON rpy.reply_by = ur.user_id
    LEFT JOIN user_customer_meta ucm ON ur.user_id = ucm.user_id
    WHERE rpy.review_id = ?`;
  const get_single_rewiew_reply_value = [reviewId];
  try{
    const get_single_rewiew_reply_result = await query(get_single_rewiew_reply_query, get_single_rewiew_reply_value);
    return get_single_rewiew_reply_result;
  }catch(error){
    return 'Error during user get_single_rewiew_query:'+error;
  }
}

async function reviewTagsCountByCompanyID(companyId){
  const get_rewiew_tag_counts_query = `
    SELECT rtr.tag_name, COUNT(*) AS count
    FROM review_tag_relation AS rtr
    JOIN reviews AS r ON rtr.review_id = r.id
    WHERE r.company_id = ? AND r.review_status = '1'
    GROUP BY rtr.tag_name`;
  const get_rewiew_tag_counts_query_value = [companyId];
  try{
    const get_rewiew_tag_counts_query_result = await query(get_rewiew_tag_counts_query, get_rewiew_tag_counts_query_value);
    return get_rewiew_tag_counts_query_result;
  }catch(error){
    return 'Error during user get_rewiew_tag_counts_query:'+error;
  }
}

async function getPopularCategories(){
  const get_popular_company_query = `
  SELECT 
  ccr.category_id,
  cg.category_name,
  cg.category_img,
  cg.category_slug,
  COUNT(*) AS review_count
  FROM 
    reviews r
  INNER JOIN
    company_cactgory_relation ccr ON r.company_id = ccr.company_id
  INNER JOIN
    category cg ON ccr.category_id = cg.ID
  WHERE 
    r.review_status = '1'
  GROUP BY 
    ccr.category_id
  ORDER BY 
    review_count DESC
  LIMIT 4;
  `;
  try{
    const get_popular_company_query_result = await query(get_popular_company_query);
    return get_popular_company_query_result;
  }catch(error){
    return 'Error during user get_rewiew_tag_counts_query:'+error;
  }
}

async function getReviewCount(){
  const get_review_count_query = `
  SELECT COUNT(*) AS total_reviews_count
  FROM reviews
  WHERE review_status = '1';
  `;
  try{
    const get_review_count_query_result = await query(get_review_count_query);
    return get_review_count_query_result;
  }catch(error){
    return 'Error during user get_rewiew_tag_counts_query:'+error;
  }
}

async function getUserCount(){
  const get_user_count_query = `
  SELECT COUNT(*) AS total_user_count
  FROM users
  WHERE user_status = 1 AND user_type_id = 2;
  `;
  try{
    const get_user_count_query_result = await query(get_user_count_query);
    return get_user_count_query_result;
  }catch(error){
    return 'Error during user get_rewiew_tag_counts_query:'+error;
  }
}

async function getCategoryDetails(category_slug){
  const get_category_query = `
  SELECT * FROM category
  WHERE category_slug = ?;
  `;
  const get_category_slug = category_slug;
  try{
    const get_category_query_result = await query(get_category_query, get_category_slug);
    // if(get_category_query_result[0].parent_id){
    //   console.log(get_category_query_result);
    // }
    return get_category_query_result;
  }catch(error){
    return 'Error during user get_category_query:'+error;
  }
}

async function getParentCategories(ID) {
  const get_category_query = `
  SELECT * FROM category
  WHERE ID = ?;
  `;
  const cat_ID = ID;
  try{
    const get_category_query_result = await query(get_category_query, cat_ID);
    // if(get_category_query_result[0].parent_id){
    //   console.log(get_category_query_result);
    // }
    return get_category_query_result;
  }catch(error){
    return 'Error during user get_category_query:'+error;
  }
}

async function getPositiveReviewsCompany() {
  const get_positive_reviews_company_query = `
  SELECT company_id, COUNT(*) AS review_count, com.company_name, com.slug
  FROM reviews
  JOIN company com ON reviews.company_id = com.ID
  WHERE rating >= 4 AND review_status = '1'
  GROUP BY company_id
  ORDER BY review_count DESC
  LIMIT 5;
  `;
  try{
    const get_positive_reviews_result = await query(get_positive_reviews_company_query);
    return get_positive_reviews_result;
  }catch(error){
    return 'Error during user get_positive_reviews_company_query:'+error;
  }
}

// async function getNegativeReviewsCompany() {
//   const get_negative_reviews_company_query = `
//   SELECT company_id, COUNT(*) AS review_count, com.company_name, com.slug
//   FROM reviews
//   JOIN company com ON reviews.company_id = com.ID
//   WHERE rating <= 2 AND review_status = '1'
//   GROUP BY company_id
//   ORDER BY review_count DESC
//   LIMIT 5;
//   `;
//   try{
//     const get_negative_reviews_result = await query(get_negative_reviews_company_query);
//     return get_negative_reviews_result;
//   }catch(error){
//     return 'Error during user get_negative_reviews_company_query:'+error;
//   }
// }

async function getNegativeReviewsCompany() {
  const get_negative_reviews_company_query = `
  SELECT
  neg.ID, COUNT(*) AS review_count, neg.company_name, neg.slug
FROM
  (
      SELECT com.ID, com.company_name, com.slug
      FROM reviews
          JOIN company com ON reviews.company_id = com.ID
      WHERE rating <= 2 AND review_status = '1'
      GROUP BY com.ID, com.company_name, com.slug
  ) AS neg
WHERE
  neg.ID NOT IN (
      SELECT
          com.ID
      FROM reviews
          JOIN company com ON reviews.company_id = com.ID
      WHERE rating >= 4 AND review_status = '1'
      GROUP BY
          com.ID
  )
GROUP BY
  neg.ID
ORDER BY
  review_count DESC
LIMIT 5;

  `;
  try{
    const get_negative_reviews_result = await query(get_negative_reviews_company_query);
    return get_negative_reviews_result;
  }catch(error){
    return 'Error during user get_negative_reviews_company_query:'+error;
  }
}

async function getVisitorCheck(ClientIp) {
  const chk_visitor_clientIp_query = `
  SELECT *
  FROM visitors
  WHERE IP_address = ?;
  `;
  const query_val = ClientIp;
  try{
    const chk_visitor_clientIp_query_result = await query(chk_visitor_clientIp_query, query_val);
    //console.log(chk_visitor_clientIp_query_result);
    //return chk_visitor_clientIp_query_result;
    if (chk_visitor_clientIp_query_result.length > 0) {
      return chk_visitor_clientIp_query_result.length;
    }else{
      const currentDate = new Date();
      const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
      const queryValues = [ClientIp, formattedDate];
      const insertVisitorQuery = `
        INSERT INTO visitors (IP_address, visit_time)
        VALUES (?, ?);
      `;
      try {
        await query(insertVisitorQuery, queryValues);
        //console.log('Visitor inserted successfully');
        return chk_visitor_clientIp_query_result.length+1;

      } catch (error) {
        //return 'Error during insertion: ' + error;
        chk_visitor_clientIp_query_result.length
      }      
    }
  }catch(error){
    return 'Error during user chk_visitor_clientIp_query: ' + error;
  }
}


async function getCompanySurveyDetails(companyID) {
  const get_company_survey_details_query = `
  SELECT survey.*
  FROM survey
  WHERE survey.company_id = ${companyID}
  ORDER BY survey.id DESC;
  `;
  try{
    const get_company_survey_details_result = await query(get_company_survey_details_query);
    return get_company_survey_details_result;
  }catch(error){
    return 'Error during user get_company_survey_details_query:'+error;
  }
}

async function getCompanyOngoingSurveyDetails(companyID) {
  const get_company_survey_details_query = `
  SELECT survey.*
  FROM survey
  WHERE survey.company_id = ${companyID} AND CURDATE() <= expire_at
  ORDER BY survey.id DESC;
  `;
  try{
    const get_company_survey_details_result = await query(get_company_survey_details_query);
    return get_company_survey_details_result;
  }catch(error){
    return 'Error during user get_company_survey_details_query:'+error;
  }
}

async function getCompanySurveyDetailsBySurveyID(survey_unique_id) {
  const get_company_survey_details_query = `
  SELECT survey.*
  FROM survey
  WHERE survey.unique_id = ${survey_unique_id};
  `;
  try{
    const get_company_survey_details_result = await query(get_company_survey_details_query);
    return get_company_survey_details_result;
  }catch(error){
    return 'Error during user get_company_survey_details_query:'+error;
  }
}

async function getCompanySurveySubmitionsCount() {
  const get_company_survey_submitions_count_query = `
  SELECT survey_unique_id, COUNT(ID) as total_submission
  FROM survey_customer_answers
  GROUP BY survey_unique_id;
  `;
  try{
    const get_company_survey_submitions_count_result = await query(get_company_survey_submitions_count_query);
    return get_company_survey_submitions_count_result;
  }catch(error){
    return 'Error during user get_company_survey_submitions_count_query:'+error;
  }
}

async function getCompanySurveySubmissions(companyID, survey_unique_id) {
  const get_company_survey_submissions_query = `
  SELECT survey_customer_answers.*, users.first_name, users.last_name
  FROM survey_customer_answers
  JOIN users ON survey_customer_answers.customer_id = users.user_id
  WHERE company_id = ${companyID} AND survey_unique_id = ${survey_unique_id}
  ORDER BY ID DESC;
  `;
  try{
    const get_company_survey_submissions_result = await query(get_company_survey_submissions_query);
    return get_company_survey_submissions_result;
  }catch(error){
    return 'Error during user get_company_survey_submissions_query:'+error;
  }
}

async function getCompanySurveyQuestions(survey_uniqueid, companyId){
  const get_company_survey_question_query = `
  SELECT *
  FROM survey
  WHERE company_id = ${companyId} AND unique_id = ${survey_uniqueid};
  `;
  try{
    const get_company_survey_question_result = await query(get_company_survey_question_query);
    return get_company_survey_question_result;
  }catch(error){
    return 'Error during user get_company_survey_question_query:'+error;
  }
}

async function getCompanySurveyAnswersByUser(survey_uniqueid, userID){
  const get_company_survey_answer_query = `
  SELECT *
  FROM survey_customer_answers
  WHERE survey_unique_id = ${survey_uniqueid} AND customer_id = ${userID};
  `;
  try{
    const get_company_survey_question_result = await query(get_company_survey_answer_query);
    return get_company_survey_question_result;
  }catch(error){
    return 'Error during user get_company_survey_answer_query:'+error;
  }
}

async function getCompanySurveyAnswersByID(survey_submission_id){
  const get_company_survey_answer_query = `
  SELECT *
  FROM survey_customer_answers
  WHERE ID = ${survey_submission_id};
  `;
  try{
    const get_company_survey_question_result = await query(get_company_survey_answer_query);
    return get_company_survey_question_result;
  }catch(error){
    return 'Error during user get_company_survey_answer_query:'+error;
  }
}

async function getCompanyReviewInvitationNumbers(companyId){

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const get_company_review_invite_request_query = `
  SELECT *
  FROM review_invite_request
  WHERE company_id = ${companyId}
  AND YEAR(share_date) = ${currentYear}
  AND MONTH(share_date) = ${currentMonth}
  ORDER BY id DESC 
  `;
  try{
    const get_company_review_invite_request_result = await query(get_company_review_invite_request_query);
    let total_count = 0;
    if(get_company_review_invite_request_result.length > 0){
      get_company_review_invite_request_result.forEach(count=>{
        total_count = total_count + count.count;
      })
      return {'thismonth_invitation': 1,thismonth_invitation_count:total_count, 'thismonth_invitation_data':get_company_review_invite_request_result};
    }else{
      return {'thismonth_invitation': 0,thismonth_invitation_count:total_count, 'thismonth_invitation_data':[]};
    }
  }catch(error){
    return 'Error during user get_company_review_invite_request_query:'+error;
  }
}

module.exports = {
    getUser,
    getUserMeta,
    getCountries,
    getUserRoles,
    getStatesByUserID,
    getAllCompany,
    getCompany,
    getCompanyCategory,
    renderCategoryTreeHTML,
    getCompanyCategoryBuID,
    saveUserGoogleLoginDataToDB,
    saveUserFacebookLoginDataToDB,
    getAllRatingTags,
    getReviewRatingData,
    getMetaValue,
    insertIntoFaqPages,
    insertIntoFaqCategories,
    insertIntoFaqItems,
    createCompany,
    createReview,
    getlatestReviews,
    getAllReviews,
    getCustomerReviewData,
    getCustomerReviewTagRelationData,
    editCustomerReview,
    searchCompany,
    getCompanyReviewNumbers,
    getCompanyReviews,
    getUsersByRole,
    getAllReviewsByCompanyID,
    getReviewByID,
    getReviewReplyDataByID,
    reviewTagsCountByCompanyID,
    getPopularCategories,
    getReviewCount,
    getUserCount,
    getCategoryDetails,
    getParentCategories,
    getPositiveReviewsCompany,
    getNegativeReviewsCompany,
    getVisitorCheck,
    getAllTrashedCompany,
    getCompanySurveyDetails,
    getCompanySurveyQuestions,
    getCompanySurveyAnswersByUser,
    getCompanySurveySubmissions,
    getCompanySurveyAnswersByID,
    getCompanySurveySubmitionsCount,
    getCompanySurveyDetailsBySurveyID,
    getCompanyOngoingSurveyDetails,
    getCompanyReviewsBetween,
    getCompanyReviewInvitationNumbers
};
