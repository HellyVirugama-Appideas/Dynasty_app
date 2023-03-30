const router = require('express').Router();
const fileUpload = require('express-fileupload');

const authController = require('../../controllers/api/authController');

router.post('/send_otp', fileUpload(), authController.sendOTP);

router.post('/verify_otp', fileUpload(), authController.verifyOTP);

router.post('/create_profile', fileUpload(), authController.createProfile);

router.post('/social_login', fileUpload(), authController.socialLogin);

router.post(
    '/create_social_profile',
    fileUpload(),
    authController.createSocialProfile
);

module.exports = router;
