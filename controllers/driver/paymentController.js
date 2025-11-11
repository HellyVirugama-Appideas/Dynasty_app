const createError = require('http-errors');
const Wallet = require('../../models/wallet');
const Driver = require('../../models/driverModel');
const withdrawalService = require('../../services/withdrawalService');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Get driver's wallet balance and transaction history
 */
exports.getWalletBalance = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // Get current wallet balance
        const availableBalance = await Wallet.calculateAvailableBalance(req.driver._id);

        // Get paginated transaction history
        const transactions = await Wallet.find({ driverId: req.driver._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('rideId', 'pickupAddress endAddress price')
            .populate('bookingId', 'address price bookedFrom bookedTo')
            .select('-__v');

        const total = await Wallet.countDocuments({ driverId: req.driver._id });

        // Get pending withdrawals
        const pendingWithdrawals = await Wallet.getPendingWithdrawals(req.driver._id);
        const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

        const formattedTransactions = transactions.map(t => ({
            ...t.toObject(),
            formattedAmount: t.amount / 100,
            formattedNetAmount: t.netAmount ? t.netAmount / 100 : null,
        }));

        res.json({
            code: '1',
            message: req.t('success'),
            balance: availableBalance / 100,
            pendingWithdrawals: pendingAmount / 100,
            canWithdraw: req.driver.canWithdraw(),
            withdrawalSettings: req.driver.withdrawalSettings,
            transactions: formattedTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                hasMore: skip + transactions.length < total,
            },
        });
    } catch (error) {
        console.error('Get wallet balance error:', error);
        next(error);
    }
};

/**
 * Get driver's transaction history with filters
 */
exports.getTransactionHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type, status, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;

        const query = { driverId: req.driver._id };
        if (type) query.type = type;
        if (status) query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const [transactions, total] = await Promise.all([
            Wallet.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('rideId', 'pickupAddress endAddress price')
                .populate('bookingId', 'address price bookedFrom bookedTo')
                .select('-__v'),
            Wallet.countDocuments(query),
        ]);

        const formattedTransactions = transactions.map(t => ({
            ...t.toObject(),
            formattedAmount: t.amount / 100,
            formattedNetAmount: t.netAmount ? t.netAmount / 100 : null,
            formattedFee: t.processingFee ? t.processingFee / 100 : null,
        }));

        res.json({
            code: '1',
            message: req.t('success'),
            transactions: formattedTransactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                hasMore: skip + transactions.length < total,
            },
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        next(error);
    }
};

/**
 * Get Stripe Connect onboarding link
 */
exports.getOnboardingLink = async (req, res, next) => {
    try {
        const accountLink = await withdrawalService.generateOnboardingLink(req.driver._id);

        res.json({
            code: '1',
            message: req.t('success'),
            onboardingUrl: accountLink.url,
        });
    } catch (error) {
        console.error('Get onboarding link error:', error);
        next(error);
    }
};

/**
 * Update Stripe Connect account status
 */
exports.updateAccountStatus = async (req, res, next) => {
    try {
        if (!req.driver.stripeConnectAccountId) {
            return next(createError.BadRequest('No Stripe account found'));
        }

        const { account, driver } = await withdrawalService.updateAccountStatus(
            req.driver.stripeConnectAccountId
        );

        res.json({
            code: '1',
            message: req.t('success'),
            accountStatus: {
                detailsSubmitted: account.details_submitted,
                payoutsEnabled: account.payouts_enabled,
                chargesEnabled: account.charges_enabled,
                onboardingCompleted: driver.stripeOnboardingCompleted,
            },
        });
    } catch (error) {
        console.error('Update account status error:', error);
        next(error);
    }
};

/**
 * Create withdrawal request
 */
exports.createWithdrawalRequest = async (req, res, next) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                code: '0',
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const { amount, description } = req.body;
        const amountInCents = Math.round(amount * 100); // Convert to cents

        // Create withdrawal request
        const withdrawal = await withdrawalService.createWithdrawalRequest(
            req.driver._id,
            amountInCents,
            description
        );

        res.json({
            code: '1',
            message: req.t('withdrawal_request_created'),
            withdrawal: {
                id: withdrawal._id,
                amount: withdrawal.amount / 100,
                netAmount: withdrawal.netAmount / 100,
                processingFee: withdrawal.processingFee / 100,
                status: withdrawal.status,
                createdAt: withdrawal.createdAt,
            },
        });
    } catch (error) {
        console.error('Create withdrawal request error:', error);
        next(error);
    }
};

/**
 * Process withdrawal (admin or automated)
 */
exports.processWithdrawal = async (req, res, next) => {
    try {
        const { withdrawalId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
            return next(createError.BadRequest('Invalid withdrawal ID'));
        }

        const result = await withdrawalService.processWithdrawal(withdrawalId);

        res.json({
            code: '1',
            message: req.t('withdrawal_processed'),
            withdrawal: {
                id: result.withdrawal._id,
                amount: result.withdrawal.amount / 100,
                netAmount: result.withdrawal.netAmount / 100,
                status: result.withdrawal.status,
                stripeTransferId: result.withdrawal.stripeTransferId,
                processedAt: result.withdrawal.updatedAt,
            },
        });
    } catch (error) {
        console.error('Process withdrawal error:', error);
        next(error);
    }
};

/**
 * Get withdrawal history
 */
exports.getWithdrawalHistory = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            startDate,
            endDate,
        } = req.query;

        const result = await withdrawalService.getWithdrawalHistory(req.driver._id, {
            page,
            limit,
            status,
            startDate,
            endDate,
        });

        res.json({
            code: '1',
            message: req.t('success'),
            ...result,
        });
    } catch (error) {
        console.error('Get withdrawal history error:', error);
        next(error);
    }
};

/**
 * Cancel withdrawal request
 */
exports.cancelWithdrawal = async (req, res, next) => {
    try {
        const { withdrawalId } = req.params;
        const { reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
            return next(createError.BadRequest('Invalid withdrawal ID'));
        }

        // Verify the withdrawal belongs to the driver
        const withdrawal = await Wallet.findOne({
            _id: withdrawalId,
            driverId: req.driver._id,
            type: 'withdrawal',
        });

        if (!withdrawal) {
            return next(createError.NotFound('Withdrawal not found'));
        }

        const cancelledWithdrawal = await withdrawalService.cancelWithdrawal(
            withdrawalId,
            reason || 'Cancelled by driver'
        );

        res.json({
            code: '1',
            message: req.t('withdrawal_cancelled'),
            withdrawal: {
                id: cancelledWithdrawal._id,
                status: cancelledWithdrawal.status,
                cancelledAt: cancelledWithdrawal.updatedAt,
                reason: cancelledWithdrawal.failureReason,
            },
        });
    } catch (error) {
        console.error('Cancel withdrawal error:', error);
        next(error);
    }
};

/**
 * Update withdrawal settings
 */
exports.updateWithdrawalSettings = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                code: '0',
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const {
            autoWithdrawal,
            autoWithdrawalThreshold,
            withdrawalDay,
            minimumAmount,
        } = req.body;

        const updateData = {};
        if (autoWithdrawal !== undefined) {
            updateData['withdrawalSettings.autoWithdrawal'] = autoWithdrawal;
        }
        if (autoWithdrawalThreshold !== undefined) {
            updateData['withdrawalSettings.autoWithdrawalThreshold'] = Math.round(autoWithdrawalThreshold * 100);
        }
        if (withdrawalDay !== undefined) {
            updateData['withdrawalSettings.withdrawalDay'] = withdrawalDay;
        }
        if (minimumAmount !== undefined) {
            updateData['withdrawalSettings.minimumAmount'] = Math.round(minimumAmount * 100);
        }

        const updatedDriver = await Driver.findByIdAndUpdate(
            req.driver._id,
            updateData,
            { new: true, select: 'withdrawalSettings' }
        );

        res.json({
            code: '1',
            message: req.t('withdrawal_settings_updated'),
            withdrawalSettings: {
                autoWithdrawal: updatedDriver.withdrawalSettings.autoWithdrawal,
                autoWithdrawalThreshold: updatedDriver.withdrawalSettings.autoWithdrawalThreshold / 100,
                withdrawalDay: updatedDriver.withdrawalSettings.withdrawalDay,
                minimumAmount: updatedDriver.withdrawalSettings.minimumAmount / 100,
            },
        });
    } catch (error) {
        console.error('Update withdrawal settings error:', error);
        next(error);
    }
};

/**
 * Get withdrawal fees and limits
 */
exports.getWithdrawalInfo = async (req, res, next) => {
    try {
        const { amount } = req.query;

        const info = {
            minimumAmount: withdrawalService.minimumWithdrawalAmount / 100,
            maximumAmount: withdrawalService.maximumWithdrawalAmount / 100,
            feePercent: withdrawalService.withdrawalFeePercent,
            minimumFee: withdrawalService.minimumWithdrawalFee / 100,
        };

        if (amount) {
            const amountInCents = Math.round(parseFloat(amount) * 100);
            const fee = withdrawalService.calculateWithdrawalFee(amountInCents);
            info.calculatedFee = fee / 100;
            info.netAmount = (amountInCents - fee) / 100;
        }

        res.json({
            code: '1',
            message: req.t('success'),
            withdrawalInfo: info,
        });
    } catch (error) {
        console.error('Get withdrawal info error:', error);
        next(error);
    }
};

/**
 * Get bank account info
 */
exports.getBankAccountInfo = async (req, res, next) => {
    try {
        const driver = await Driver.findById(req.driver._id).select('bankAccount stripeConnectAccountId');

        res.json({
            code: '1',
            message: req.t('success'),
            bankAccount: driver.getFormattedBankAccount(),
            hasStripeAccount: !!driver.stripeConnectAccountId,
        });
    } catch (error) {
        console.error('Get bank account info error:', error);
        next(error);
    }
};

/**
 * Webhook handler for Stripe Connect events
 */
exports.handleStripeWebhook = async (req, res, next) => {
    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;
        try {
            event = require('stripe').webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'account.updated':
                await handleAccountUpdated(event.data.object);
                break;

            case 'transfer.paid':
                await handleTransferPaid(event.data.object);
                break;

            case 'transfer.failed':
                await handleTransferFailed(event.data.object);
                break;

            case 'payout.paid':
                await handlePayoutPaid(event.data.object);
                break;

            case 'payout.failed':
                await handlePayoutFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

// Helper functions for webhook handling
async function handleAccountUpdated(account) {
    try {
        await withdrawalService.updateAccountStatus(account.id);
        console.log('Account updated:', account.id);
    } catch (error) {
        console.error('Error handling account update:', error);
    }
}

async function handleTransferPaid(transfer) {
    try {
        await Wallet.findOneAndUpdate(
            { stripeTransferId: transfer.id },
            {
                status: 'completed',
                updatedAt: new Date(),
            }
        );
        console.log('Transfer completed:', transfer.id);
    } catch (error) {
        console.error('Error handling transfer paid:', error);
    }
}

async function handleTransferFailed(transfer) {
    try {
        await Wallet.findOneAndUpdate(
            { stripeTransferId: transfer.id },
            {
                status: 'failed',
                failureReason: transfer.failure_message || 'Transfer failed',
                updatedAt: new Date(),
            }
        );
        console.log('Transfer failed:', transfer.id);
    } catch (error) {
        console.error('Error handling transfer failed:', error);
    }
}

async function handlePayoutPaid(payout) {
    console.log('Payout completed:', payout.id);
    // Additional logic for payout tracking if needed
}

async function handlePayoutFailed(payout) {
    console.log('Payout failed:', payout.id);
    // Additional logic for failed payout handling if needed
}
