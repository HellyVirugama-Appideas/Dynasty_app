const createError = require('http-errors');

const { generateOrderId } = require('../../utils/orderUtils');

const Transaction = require('../../models/transaction');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createPaymentIntent = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const tempOrder = new Transaction({
            orderId: generateOrderId(6),
            userId,
            amount: req.body.amount,
            paymentMethod: req.body.paymentMethod, // 'wallet', 'cash'
            // rideId: req.body.rideId,
        });

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total * 100),
            currency: 'EUR',
        });

        tempOrder.paymentIntentId = paymentIntent.id;
        await tempOrder.save();

        res.status(201).json({
            status: 'success',
            code: 201,
            message: req.t('success'),
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        next(error);
    }
};

exports.createOrder = async (req, res, next) => {
    try {
        const { paymentIntentId } = req.body;
        const userId = req.user.id;

        const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId
        );
        if (paymentIntent.status != 'succeeded')
            return next(
                createError.BadRequest(
                    `Payment status: '${paymentIntent.status}'`
                )
            );

        // Get temp order with this paymentIntentId
        const tempOrder = await TempOrder.findOneAndDelete({
            paymentIntentId,
        }).lean();
        if (!tempOrder) return next(createError.InternalServerError());

        // const order = await Order.create({
        //     ...tempOrder,
        //     paymentMethod: 'Card',
        //     invoiceGenerated: true,
        // });

        res.status(201).json({
            status: 'success',
            code: 201,
            message: req.t('order'),
            order: removeFields(order),
        });
    } catch (error) {
        next(error);
    }
};
