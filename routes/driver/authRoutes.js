const router = require('express').Router();
const fileUpload = require('express-fileupload');

const authController = require('../../controllers/driver/authController');

router.post('/send_otp', fileUpload(), authController.sendOTP);

router.post('/verify_otp', fileUpload(), authController.verifyOTP);

module.exports = router;
