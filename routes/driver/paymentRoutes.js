const router = require('express').Router();
const fileUpload = require('express-fileupload');
const { checkDriver } = require('../../controllers/driver/authController');
const paymentController = require('../../controllers/driver/paymentController');

// Wallet routes
router.post(
     '/wallet/balance',
     fileUpload(),
     checkDriver,
     paymentController.getWalletBalance
);

// Transaction history
router.get(
     '/wallet/transactions',
     checkDriver,
     paymentController.getTransactionHistory
);

module.exports = router;
