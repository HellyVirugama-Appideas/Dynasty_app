const router = require('express').Router();

const { checkUser } = require('../../controllers/user/authController');
const stripeController = require('../../controllers/user/stripeController');

router.post(
    '/create-payment-intent',
    checkUser,
    stripeController.createPaymentIntent
);

router.post('/create-order', checkUser, stripeController.createOrder);

module.exports = router;
