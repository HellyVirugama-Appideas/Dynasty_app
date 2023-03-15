const router = require('express').Router();

const authController = require('../../controllers/api/authController');

router.post('/send_otp', authController.sendOTP);

router.post('/verify_otp', authController.verifyOTP);

router.post('/create_profile', authController.createProfile);

module.exports = router;
