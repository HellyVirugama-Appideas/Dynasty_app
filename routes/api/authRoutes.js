const router = require('express').Router();

const authController = require('../../controllers/api/authController');

router.post('/get-otp', authController.getOTP);

router.post('/verify-otp', authController.verifyOTP);

router.post('/create-profile', authController.createProfile);

module.exports = router;
