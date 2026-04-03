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

// Withdrawal flows
router.post(
     '/wallet/withdraw',
     checkDriver,
     paymentController.createWithdrawalRequest
);
router.get(
     '/wallet/withdrawals',
     checkDriver,
     paymentController.getWithdrawalHistory
);
router.delete(
     '/wallet/withdraw/:withdrawalId',
     checkDriver,
     paymentController.cancelWithdrawal
);



// === Withdrawal Settings & Info ===
router.put(
  '/wallet/withdrawal-settings',
  checkDriver,
  // validation middleware add kar sakti hai
  paymentController.updateWithdrawalSettings
);

router.get(
  '/wallet/withdrawal-info',
  checkDriver,
  paymentController.getWithdrawalInfo
);

// === Bank & Stripe Connect Related ===
router.get(
  '/wallet/bank-info',
  checkDriver,
  paymentController.getBankAccountInfo
);

router.get(
  '/wallet/stripe-onboarding',
  checkDriver,
  paymentController.getOnboardingLink
);

router.get(
  '/wallet/stripe-account-status',
  checkDriver,
  paymentController.updateAccountStatus   // note: iska naam thoda misleading hai, better rename to getAccountStatus
);

// === Webhook (public, no auth) ===
router.post(
  '/wallet/stripe-webhook',
  // express.raw({ type: 'application/json' }) middleware chahiye body parsing ke liye
  paymentController.handleStripeWebhook
);


module.exports = router;
