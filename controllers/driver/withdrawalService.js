const stripe = require('../config/stripe');
const Wallet = require('../models/wallet');
const Driver = require('../models/driverModel');
const createError = require('http-errors');

class WithdrawalService {
    constructor() {
        this.minimumWithdrawalAmount = 1000; // $10.00 in cents
        this.maximumWithdrawalAmount = 100000000; // $1,000,000 in cents
        this.withdrawalFeePercent = 0.25; // 0.25% fee
        this.minimumWithdrawalFee = 25; // $0.25 minimum fee in cents
    }

    /**
     * Create Stripe Connect Express account for driver
     */
    async createConnectAccount(driver) {
        try {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US', // You should set this based on driver's country
                email: driver.email,
                capabilities: {
                    transfers: { requested: true },
                },
                business_type: 'individual',
                individual: {
                    first_name: driver.name.split(' ')[0],
                    last_name:
                        driver.name.split(' ').slice(1).join(' ') ||
                        driver.name.split(' ')[0],
                    email: driver.email,
                    phone: driver.phone,
                    address: {
                        line1: driver.address,
                    },
                },
                metadata: {
                    driverId: driver._id.toString(),
                },
            });

            // Update driver with Stripe account ID
            await Driver.findByIdAndUpdate(driver._id, {
                stripeConnectAccountId: account.id,
                stripeAccountStatus: 'pending',
            });

            return account;
        } catch (error) {
            console.error('Error creating Stripe Connect account:', error);
            throw createError.BadRequest('Failed to create payment account');
        }
    }

    /**
     * Generate account onboarding link
     */
    async generateOnboardingLink(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw createError.NotFound('Driver not found');
            }

            let accountId = driver.stripeConnectAccountId;

            // Create account if doesn't exist
            if (!accountId) {
                const account = await this.createConnectAccount(driver);
                accountId = account.id;
            }

            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: `${process.env.FRONTEND_URL}/driver/onboarding/refresh`,
                return_url: `${process.env.FRONTEND_URL}/driver/onboarding/complete`,
                type: 'account_onboarding',
            });

            return accountLink;
        } catch (error) {
            console.error('Error generating onboarding link:', error);
            throw createError.BadRequest('Failed to generate onboarding link');
        }
    }

    /**
     * Update account status after onboarding
     */
    async updateAccountStatus(accountId) {
        try {
            const account = await stripe.accounts.retrieve(accountId);
            const driver = await Driver.findOne({
                stripeConnectAccountId: accountId,
            });

            if (!driver) {
                throw createError.NotFound('Driver not found for account');
            }

            const updates = {
                stripeAccountStatus: account.details_submitted
                    ? 'enabled'
                    : 'pending',
                stripeDetailsSubmitted: account.details_submitted,
                stripePayoutsEnabled: account.payouts_enabled,
                stripeChargesEnabled: account.charges_enabled,
                stripeOnboardingCompleted:
                    account.details_submitted && account.payouts_enabled,
            };

            await Driver.findByIdAndUpdate(driver._id, updates);

            return { account, driver: { ...driver.toObject(), ...updates } };
        } catch (error) {
            console.error('Error updating account status:', error);
            throw createError.BadRequest('Failed to update account status');
        }
    }

    /**
     * Calculate withdrawal fee
     */
    calculateWithdrawalFee(amount) {
        const feeAmount = Math.max(
            Math.round(amount * (this.withdrawalFeePercent / 100)),
            this.minimumWithdrawalFee
        );
        return feeAmount;
    }

    /**
     * Validate withdrawal request
     */
    async validateWithdrawalRequest(driverId, amount) {
        const driver = await Driver.findById(driverId);
        if (!driver) {
            throw createError.NotFound('Driver not found');
        }

        // Check if driver can withdraw
        if (!driver.canWithdraw()) {
            throw createError.BadRequest('Driver not eligible for withdrawals');
        }

        // Check minimum amount
        if (amount < this.minimumWithdrawalAmount) {
            throw createError.BadRequest(
                `Minimum withdrawal amount is $${
                    this.minimumWithdrawalAmount / 100
                }`
            );
        }

        // Check maximum amount
        if (amount > this.maximumWithdrawalAmount) {
            throw createError.BadRequest(
                `Maximum withdrawal amount is $${
                    this.maximumWithdrawalAmount / 100
                }`
            );
        }

        // Check available balance
        const availableBalance = await Wallet.calculateAvailableBalance(
            driverId
        );
        if (amount > availableBalance) {
            throw createError.BadRequest('Insufficient balance for withdrawal');
        }

        // Check for pending withdrawals
        const pendingWithdrawals = await Wallet.getPendingWithdrawals(driverId);
        if (pendingWithdrawals.length > 0) {
            throw createError.BadRequest(
                'You have pending withdrawals. Please wait for them to complete.'
            );
        }

        return { driver, availableBalance };
    }

    /**
     * Create withdrawal request
     */
    async createWithdrawalRequest(
        driverId,
        amount,
        description = 'Driver earnings withdrawal'
    ) {
        try {
            // Validate the request
            const { driver } = await this.validateWithdrawalRequest(
                driverId,
                amount
            );

            // Calculate fee
            const withdrawalFee = this.calculateWithdrawalFee(amount);
            const netAmount = amount - withdrawalFee;

            // Create withdrawal transaction record
            const withdrawalTransaction = new Wallet({
                driverId: driverId,
                type: 'withdrawal',
                amount: amount,
                netAmount: netAmount,
                processingFee: withdrawalFee,
                status: 'pending',
                description: description,
                withdrawalMethod: 'stripe_express',
                stripeConnectAccountId: driver.stripeConnectAccountId,
            });

            await withdrawalTransaction.save();

            // Create fee transaction record
            if (withdrawalFee > 0) {
                const feeTransaction = new Wallet({
                    driverId: driverId,
                    type: 'withdrawal_fee',
                    amount: withdrawalFee,
                    status: 'completed',
                    description: `Withdrawal processing fee for transaction ${withdrawalTransaction._id}`,
                });

                await feeTransaction.save();
            }

            return withdrawalTransaction;
        } catch (error) {
            console.error('Error creating withdrawal request:', error);
            throw error;
        }
    }

    /**
     * Process withdrawal using Stripe Connect
     */
    async processWithdrawal(withdrawalId) {
        try {
            const withdrawal = await Wallet.findById(withdrawalId).populate(
                'driverId'
            );
            if (!withdrawal) {
                throw createError.NotFound('Withdrawal not found');
            }

            if (withdrawal.status !== 'pending') {
                throw createError.BadRequest(
                    'Withdrawal is not in pending status'
                );
            }

            // Update status to processing
            withdrawal.status = 'processing';
            await withdrawal.save();

            // Create transfer to driver's connected account
            const transfer = await stripe.transfers.create({
                amount: withdrawal.netAmount,
                currency: 'usd',
                destination: withdrawal.stripeConnectAccountId,
                description: withdrawal.description,
                metadata: {
                    driverId: withdrawal.driverId._id.toString(),
                    withdrawalId: withdrawal._id.toString(),
                },
            });

            // Update withdrawal with transfer ID
            withdrawal.stripeTransferId = transfer.id;
            withdrawal.status = 'completed';
            await withdrawal.save();

            return { withdrawal, transfer };
        } catch (error) {
            console.error('Error processing withdrawal:', error);

            // Update withdrawal status to failed
            if (withdrawalId) {
                await Wallet.findByIdAndUpdate(withdrawalId, {
                    status: 'failed',
                    failureReason: error.message || 'Transfer failed',
                });
            }

            throw createError.BadRequest('Failed to process withdrawal');
        }
    }

    /**
     * Handle automatic withdrawals
     */
    async processAutoWithdrawals() {
        try {
            const driversWithAutoWithdrawal = await Driver.find({
                'withdrawalSettings.autoWithdrawal': true,
                stripePayoutsEnabled: true,
                approved: true,
                blocked: false,
            });

            const results = [];

            for (const driver of driversWithAutoWithdrawal) {
                try {
                    const availableBalance =
                        await Wallet.calculateAvailableBalance(driver._id);
                    const threshold =
                        driver.withdrawalSettings.autoWithdrawalThreshold;

                    if (availableBalance >= threshold) {
                        const withdrawal = await this.createWithdrawalRequest(
                            driver._id,
                            availableBalance,
                            'Automatic withdrawal'
                        );

                        const processedWithdrawal =
                            await this.processWithdrawal(withdrawal._id);

                        results.push({
                            success: true,
                            driverId: driver._id,
                            amount: availableBalance,
                            transferId: processedWithdrawal.transfer.id,
                        });
                    }
                } catch (error) {
                    console.error(
                        `Error processing auto withdrawal for driver ${driver._id}:`,
                        error
                    );
                    results.push({
                        success: false,
                        driverId: driver._id,
                        error: error.message,
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error processing auto withdrawals:', error);
            throw error;
        }
    }

    /**
     * Get withdrawal history for driver
     */
    async getWithdrawalHistory(driverId, options = {}) {
        const { page = 1, limit = 20, status, startDate, endDate } = options;

        const skip = (page - 1) * limit;
        const query = {
            driverId: driverId,
            type: { $in: ['withdrawal', 'withdrawal_fee'] },
        };

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
                .select('-__v'),
            Wallet.countDocuments(query),
        ]);

        return {
            transactions: transactions.map(t => ({
                ...t.toObject(),
                formattedAmount: t.amount / 100,
                formattedNetAmount: t.netAmount ? t.netAmount / 100 : null,
                formattedFee: t.processingFee ? t.processingFee / 100 : null,
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                hasMore: skip + transactions.length < total,
            },
        };
    }

    /**
     * Cancel pending withdrawal
     */
    async cancelWithdrawal(withdrawalId, reason = 'Cancelled by user') {
        try {
            const withdrawal = await Wallet.findById(withdrawalId);
            if (!withdrawal) {
                throw createError.NotFound('Withdrawal not found');
            }

            if (withdrawal.status !== 'pending') {
                throw createError.BadRequest(
                    'Can only cancel pending withdrawals'
                );
            }

            withdrawal.status = 'cancelled';
            withdrawal.failureReason = reason;
            await withdrawal.save();

            return withdrawal;
        } catch (error) {
            console.error('Error canceling withdrawal:', error);
            throw error;
        }
    }
}

module.exports = new WithdrawalService();
