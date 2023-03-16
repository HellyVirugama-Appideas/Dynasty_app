const router = require('express').Router();
const fileUpload = require('express-fileupload');

const authController = require('../../controllers/api/authController');

router.post('/send_otp', fileUpload(), authController.sendOTP);

router.post('/verify_otp', fileUpload(), authController.verifyOTP);

router.post('/create_profile', fileUpload(), authController.createProfile);

module.exports = router;
