const router = require('express').Router();
const fileUpload = require('express-fileupload');
const { checkUser } = require('../../controllers/user/authController');
const paymentController = require('../../controllers/user/Paymentcontroller');

// Wallet routes
router.post(
    '/wallet/balance',
    fileUpload(),
    checkUser,
    paymentController.getWalletBalance
);
router.post(
    '/wallet/topup/create',
    fileUpload(),
    checkUser,
    paymentController.createWalletTopup
);
router.post(
    '/wallet/topup/confirm',
    fileUpload(),
    checkUser,
    paymentController.confirmWalletTopup
);
router.post(
    '/wallet/pay-ride',
    fileUpload(),
    checkUser,
    paymentController.payRideWithWallet
);
router.post(
    '/wallet/pay-booking',
    fileUpload(),
    checkUser,
    paymentController.payBookingWithWallet
);

// Direct Stripe payment routes
router.post(
    '/payment/create',
    fileUpload(),
    checkUser,
    paymentController.createDirectPayment
);
router.post(
    '/payment/confirm',
    fileUpload(),
    checkUser,
    paymentController.confirmDirectPayment
);

// Transaction history
router.get('/transactions', checkUser, paymentController.getTransactionHistory);

// Payment methods management
router.get(
    '/payment-methods',
    checkUser,
    paymentController.getSavedPaymentMethods
);
router.post(
    '/payment-methods/set-default',
    fileUpload(),
    checkUser,
    paymentController.setDefaultPaymentMethod
);
router.post(
    '/payment-methods/delete',
    fileUpload(),
    checkUser,
    paymentController.deletePaymentMethod
);

// Stripe webhook (no authentication needed - Stripe signs it)
// router.post('/stripe/webhook', paymentController.stripeWebhook);

module.exports = router;
