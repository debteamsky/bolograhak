const express = require('express');
const multer = require('multer');
const authenController = require('../controllers/authentication');
//const db = require('../config');


const router = express.Router();
//const publicPath = path.join(__dirname,'../public');

// Set up multer storage for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // const originalname = file.originalname;
        // const sanitizedFilename = originalname.replace(/[^a-zA-Z0-9\-\_\.]/g, ''); // Remove symbols and spaces
        // const filename = Date.now() + '-' + sanitizedFilename;
        // cb(null, filename);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    }
});
// Create multer instance
const upload = multer({ storage: storage });



router.post('/register',upload.single('profile_pic') ,authenController.register);
router.post('/login', authenController.login);
router.put('/edituser',upload.single('profile_pic') ,authenController.edituser);
router.post('/createcategories',upload.single('c_image'),authenController.createcategories);
router.post('/createcompany',upload.single('logo') ,authenController.createcompany);
router.put('/editcompany',upload.single('logo') ,authenController.editcompany);
router.post('/createcompanylocation',authenController.createcompanylocation);
router.post('/submitReview',authenController.submitReview);
module.exports = router;