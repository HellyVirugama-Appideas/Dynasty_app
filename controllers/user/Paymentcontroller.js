const createError = require('http-errors');
const stripe = require('../../config/stripe.js');
const User = require('../../models/userModel');
const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const Ride = require('../../models/rideModel');
const Booking = require('../../models/bookingModel');

/**
 * Get user's wallet balance and transaction history
 */
exports.getWalletBalance = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.body;
        const skip = (page - 1) * limit;

        // Get current wallet balance (sum of all completed transactions)
        const walletTransactions = await Wallet.find({
            userId: req.user.id,
            status: 'completed',
        });

        let balance = 0;
        walletTransactions.forEach(transaction => {
            if (transaction.type === 'add') {
                balance += transaction.amount;
            } else if (transaction.type === 'use') {
                balance -= transaction.amount;
            }
        });

        // Get paginated transaction history
        const transactions = await Wallet.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await Wallet.countDocuments({ userId: req.user.id });

        const formattedTransactions = transactions.map(t => ({
            ...t.toObject(),
            amountDisplay: t.amount / 100, // convert cents → dollars
        }));

        res.json({
            code: '1',
            message: req.t('success'),
            balance: balance / 100, // Convert from cents to currency
            // transactions: formattedTransactions,
            transactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                hasMore: skip + transactions.length < total,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create Stripe payment intent for adding money to wallet
 */
exports.createWalletTopup = async (req, res, next) => {
    try {
        const { amount } = req.body; // amount in currency units (e.g., dollars)

        if (!amount || amount <= 0) {
            return next(createError.BadRequest('Invalid amount'));
        }

        const amountInCents = Math.round(amount * 100);

        // Create or get Stripe customer
        let stripeCustomerId = req.user.stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.name,
                metadata: {
                    userId: req.user.id.toString(),
                },
            });
            stripeCustomerId = customer.id;

            // Save customer ID to user
            await User.findByIdAndUpdate(req.user.id, {
                stripeCustomerId: customer.id,
            });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: process.env.STRIPE_CURRENCY || 'usd',
            customer: stripeCustomerId,
            metadata: {
                userId: req.user.id.toString(),
                type: 'wallet_topup',
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Create pending wallet transaction
        const walletTransaction = await Wallet.create({
            userId: req.user.id,
            type: 'add',
            amount: amountInCents,
            status: 'pending',
            stripeCustomerId: paymentIntent.id,
        });

        res.json({
            code: '1',
            message: req.t('payment.intent.created'),
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            transactionId: walletTransaction._id,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Confirm wallet topup after successful Stripe payment
 */
exports.confirmWalletTopup = async (req, res, next) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return next(
                createError.BadRequest('Payment intent ID is required')
            );
        }

        // Verify payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId
        );

        // if (paymentIntent.status !== 'succeeded') {
        //     console.log('paymentIntent.status: ', paymentIntent.status);
        //     return next(createError.BadRequest('Payment not successful'));
        // }

        // Update wallet transaction
        const walletTransaction = await Wallet.findOneAndUpdate(
            {
                userId: req.user.id,
                stripeCustomerId: paymentIntentId,
                status: 'pending',
            },
            { status: 'completed' },
            { new: true }
        );

        if (!walletTransaction) {
            return next(createError.NotFound('Transaction not found'));
        }

        // Calculate new balance
        const walletTransactions = await Wallet.find({
            userId: req.user.id,
            status: 'completed',
        });

        let balance = 0;
        walletTransactions.forEach(transaction => {
            if (transaction.type === 'add') {
                balance += transaction.amount;
            } else if (transaction.type === 'use') {
                balance -= transaction.amount;
            }
        });

        res.json({
            code: '1',
            message: req.t('wallet.topup.success'),
            balance: balance / 100,
            transaction: walletTransaction,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Process payment for ride using wallet
 */
exports.payRideWithWallet = async (req, res, next) => {
    try {
        const { rideId, amount } = req.body;

        if (!rideId || !amount || amount <= 0) {
            return next(createError.BadRequest('Invalid ride ID or amount'));
        }

        const amountInCents = Math.round(amount * 100);

        // Check if ride exists
        const ride = await Ride.findById(rideId);
        if (!ride) {
            return next(createError.NotFound('Ride not found'));
        }

        // Verify user owns this ride
        if (ride.user.toString() !== req.user.id.toString()) {
            return next(createError.Forbidden('Unauthorized'));
        }

        // Calculate current wallet balance
        const walletTransactions = await Wallet.find({
            userId: req.user.id,
            status: 'completed',
        });

        let balance = 0;
        walletTransactions.forEach(transaction => {
            if (transaction.type === 'add') {
                balance += transaction.amount;
            } else if (transaction.type === 'use') {
                balance -= transaction.amount;
            }
        });

        // Check if sufficient balance
        if (balance < amountInCents) {
            return res.json({
                code: '0',
                message: req.t('wallet.insufficient.balance'),
                balance: balance / 100,
                required: amount,
            });
        }

        // Create wallet deduction transaction
        const walletTransaction = await Wallet.create({
            userId: req.user.id,
            type: 'use',
            amount: amountInCents,
            status: 'completed',
        });

        // Create transaction record
        const transaction = await Transaction.create({
            userId: req.user.id,
            amount: amountInCents,
            paymentMethod: 'wallet',
            type: 'ride_payment',
            status: 'completed',
            rideId: rideId,
        });

        // Update ride payment status
        // await Ride.findByIdAndUpdate(rideId, {
        //     paymentStatus: 'completed',
        //     paymentMethod: 'wallet',
        // });

        const newBalance = balance - amountInCents;

        res.json({
            code: '1',
            message: req.t('payment.successful'),
            balance: newBalance / 100,
            transaction: {
                id: transaction._id,
                amount: amount,
                rideId: rideId,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Process payment for booking using wallet
 */
exports.payBookingWithWallet = async (req, res, next) => {
    try {
        const { bookingId, amount } = req.body;

        if (!bookingId || !amount || amount <= 0) {
            return next(createError.BadRequest('Invalid booking ID or amount'));
        }

        const amountInCents = Math.round(amount * 100);

        // Check if booking exists
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return next(createError.NotFound('Booking not found'));
        }

        // Verify user owns this booking
        if (booking.user.toString() !== req.user.id.toString()) {
            return next(createError.Forbidden('Unauthorized'));
        }

        // Calculate current wallet balance
        const walletTransactions = await Wallet.find({
            userId: req.user.id,
            status: 'completed',
        });

        let balance = 0;
        walletTransactions.forEach(transaction => {
            if (transaction.type === 'add') {
                balance += transaction.amount;
            } else if (transaction.type === 'use') {
                balance -= transaction.amount;
            }
        });

        // Check if sufficient balance
        if (balance < amountInCents) {
            return res.json({
                code: '0',
                message: req.t('wallet.insufficient.balance'),
                balance: balance / 100,
                required: amount,
            });
        }

        // Create wallet deduction transaction
        const walletTransaction = await Wallet.create({
            userId: req.user.id,
            type: 'use',
            amount: amountInCents,
            status: 'completed',
        });

        // Create transaction record
        const transaction = await Transaction.create({
            userId: req.user.id,
            amount: amountInCents,
            paymentMethod: 'wallet',
            type: 'rent car',
            status: 'completed',
            rideId: bookingId, // Using rideId field for bookingId
        });

        // Update booking payment status
        await Booking.findByIdAndUpdate(bookingId, {
            paymentStatus: 'completed',
            paymentMethod: 'wallet',
        });

        const newBalance = balance - amountInCents;

        res.json({
            code: '1',
            message: req.t('payment.successful'),
            balance: newBalance / 100,
            transaction: {
                id: transaction._id,
                amount: amount,
                bookingId: bookingId,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create Stripe payment intent for direct ride/booking payment
 */
exports.createDirectPayment = async (req, res, next) => {
    try {
        const { amount, type, referenceId } = req.body; // type: 'ride' or 'booking', referenceId: ride/booking ID

        if (!amount || amount <= 0 || !type || !referenceId) {
            return next(createError.BadRequest('Invalid payment details'));
        }

        const amountInCents = Math.round(amount * 100);

        // Verify the ride/booking exists and belongs to user
        let reference;
        if (type === 'ride') {
            reference = await Ride.findOne({
                _id: referenceId,
                // user: req.user.id, // ! Uncomment in prod if Ride has user field
            });
        } else if (type === 'booking') {
            reference = await Booking.findOne({
                _id: referenceId,
                user: req.user.id,
            });
        } else {
            return next(createError.BadRequest('Invalid payment type'));
        }

        if (!reference) {
            return next(createError.NotFound(`${type} not found`));
        }

        // Create or get Stripe customer
        let stripeCustomerId = req.user.stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.name,
                metadata: {
                    userId: req.user.id.toString(),
                },
            });
            stripeCustomerId = customer.id;

            await User.findByIdAndUpdate(req.user.id, {
                stripeCustomerId: customer.id,
            });
        }
            console.log('stripeCustomerId: ', stripeCustomerId);

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: process.env.STRIPE_CURRENCY || 'usd',

            payment_method: 'pm_card_visa', //! Stripe test card
            confirm: true, //! auto-confirm
            // ! remove this in production

            customer: stripeCustomerId,
            metadata: {
                userId: req.user.id.toString(),
                type: type === 'ride' ? 'ride_payment' : 'rent car',
                referenceId: referenceId,
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never', //! remove in production
            },
        });
            console.log('paymentIntent: ', paymentIntent);

        // Create pending transaction
        // const transaction = await Transaction.create({
        //     userId: req.user.id,
        //     amount: amountInCents,
        //     paymentMethod: 'card',
        //     type: type === 'ride' ? 'ride_payment' : 'rent car',
        //     status: 'pending',
        //     rideId: referenceId,
        //     stripePaymentId: paymentIntent.id,
        // });

        res.json({
            code: '1',
            message: req.t('payment.intent.created'),
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            transactionId: transaction._id,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Confirm direct payment after successful Stripe payment
 */
exports.confirmDirectPayment = async (req, res, next) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return next(
                createError.BadRequest('Payment intent ID is required')
            );
        }

        // Verify payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId
        );
            console.log('paymentIntent: ', paymentIntent);

        if (paymentIntent.status !== 'succeeded') {
            return next(createError.BadRequest('Payment not successful'));
        }

        // Update transaction
        // const transaction = await Transaction.findOneAndUpdate(
        //     {
        //         userId: req.user.id,
        //         stripePaymentId: paymentIntentId,
        //         status: 'pending',
        //     },
        //     { status: 'completed' },
        //     { new: true }
        // );

        // if (!transaction) {
        //     return next(createError.NotFound('Transaction not found'));
        // }

        // // Update ride/booking payment status
        // if (transaction.type === 'ride_payment') {
        //     await Ride.findByIdAndUpdate(transaction.rideId, {
        //         paymentStatus: 'completed',
        //         paymentMethod: 'card',
        //     });
        // } else {
        //     await Booking.findByIdAndUpdate(transaction.rideId, {
        //         paymentStatus: 'completed',
        //         paymentMethod: 'card',
        //     });
        // }

        res.json({
            code: '1',
            message: req.t('payment.successful'),
            // transaction,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get transaction history
 */
exports.getTransactionHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const skip = (page - 1) * limit;

        const query = { userId: req.user.id };
        if (type) query.type = type;

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('rideId', 'pickupLocation dropLocation fare')
            .select('-__v');

        const total = await Transaction.countDocuments(query);

        res.json({
            code: '1',
            message: req.t('success'),
            transactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalTransactions: total,
                hasMore: skip + transactions.length < total,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Webhook handler for Stripe events (for production use)
 */
exports.stripeWebhook = async (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    console.log('sig: ', sig);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    console.log('webhookSecret: ', webhookSecret);

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log('event: ', event);
    } catch (err) {
        console.log('err: ', err);
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful!', paymentIntent.id);

            // Update transaction or wallet based on metadata
            if (paymentIntent.metadata.type === 'wallet_topup') {
                await Wallet.findOneAndUpdate(
                    { stripeCustomerId: paymentIntent.id },
                    { status: 'completed' }
                );
            } else {
                await Transaction.findOneAndUpdate(
                    { stripePaymentId: paymentIntent.id },
                    { status: 'completed' }
                );
            }
            break;

        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log('PaymentIntent failed:', failedPayment.id);

            // Update transaction or wallet to failed
            if (failedPayment.metadata.type === 'wallet_topup') {
                await Wallet.findOneAndUpdate(
                    { stripeCustomerId: failedPayment.id },
                    { status: 'failed' }
                );
            } else {
                await Transaction.findOneAndUpdate(
                    { stripePaymentId: failedPayment.id },
                    { status: 'failed' }
                );
            }
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};

/**
 * Get saved payment methods
 */
exports.getSavedPaymentMethods = async (req, res, next) => {
    try {
        if (!req.user.stripeCustomerId) {
            return res.json({
                code: '1',
                message: req.t('success'),
                paymentMethods: [],
            });
        }

        const paymentMethods = await stripe.paymentMethods.list({
            customer: req.user.stripeCustomerId,
            type: 'card',
        });

        const formattedMethods = paymentMethods.data.map(pm => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
            isDefault: pm.id === req.user.defaultPaymentMethod,
        }));

        res.json({
            code: '1',
            message: req.t('success'),
            paymentMethods: formattedMethods,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Set default payment method
 */
exports.setDefaultPaymentMethod = async (req, res, next) => {
    try {
        const { paymentMethodId } = req.body;

        if (!paymentMethodId) {
            return next(
                createError.BadRequest('Payment method ID is required')
            );
        }

        // Verify payment method belongs to user
        const paymentMethod = await stripe.paymentMethods.retrieve(
            paymentMethodId
        );

        if (paymentMethod.customer !== req.user.stripeCustomerId) {
            return next(createError.Forbidden('Unauthorized'));
        }

        // Update user's default payment method
        await User.findByIdAndUpdate(req.user.id, {
            defaultPaymentMethod: paymentMethodId,
        });

        res.json({
            code: '1',
            message: req.t('payment.method.updated'),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete payment method
 */
exports.deletePaymentMethod = async (req, res, next) => {
    try {
        const { paymentMethodId } = req.body;

        if (!paymentMethodId) {
            return next(
                createError.BadRequest('Payment method ID is required')
            );
        }

        // Verify payment method belongs to user
        const paymentMethod = await stripe.paymentMethods.retrieve(
            paymentMethodId
        );

        if (paymentMethod.customer !== req.user.stripeCustomerId) {
            return next(createError.Forbidden('Unauthorized'));
        }

        // Detach payment method
        await stripe.paymentMethods.detach(paymentMethodId);

        // If it was the default, clear it
        if (req.user.defaultPaymentMethod === paymentMethodId) {
            await User.findByIdAndUpdate(req.user.id, {
                defaultPaymentMethod: null,
            });
        }

        res.json({
            code: '1',
            message: req.t('payment.method.deleted'),
        });
    } catch (error) {
        next(error);
    }
};
