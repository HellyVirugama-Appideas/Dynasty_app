const geolib = require('geolib');
const createError = require('http-errors');

const Driver = require('../../models/driverModel');
const Charges = require('../../models/chargesModel');
const Ride = require('../../models/rideModel');

exports.getRides = async (req, res, next) => {
    try {
        const accepted = ['en', 'fr', 'ar'];
        let language = accepted.includes(req.headers['accept-language'])
            ? req.headers['accept-language']
            : 'en';

        const { pickupLat, pickupLng, endLat, endLng } = req.body;
        if (!pickupLat || !pickupLng || !endLat || !endLng)
            return next(createError.BadRequest('Invalid coordinates.'));

        // find available drivers
        let [drivers, charges] = await Promise.all([
            Driver.find({
                status: 'online',
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [pickupLng, pickupLat],
                        },
                        $maxDistance: 10000, // distance in meters
                    },
                },
            }).populate('type'),
            Charges.findOne(),
        ]);

        // type is in ['Taxi', 'Bike'] not 	Delivery
        drivers = drivers.filter(driver => {
            const typeFor = driver.type ? driver.type.typeFor : null;
            return typeFor === 'Bike' || typeFor === 'Taxi';
        });

        let rides = [];
        const speed = 30; // speed in km/h
        drivers.map(driver => {
            const driverDistance = geolib.getDistance(
                {
                    latitude: driver.location.coordinates[1],
                    longitude: driver.location.coordinates[0],
                },
                { latitude: pickupLat, longitude: pickupLng }
            );
            const timeToArrival = Math.round(
                (driverDistance / 1000 / speed) * 60
            ); // time in minutes

            const distance = geolib.getDistance(
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: endLat, longitude: endLng }
            );
            const distanceCharge = (distance / 1000) * driver.type.distanceRate;
            const price = (
                Math.max(
                    charges.baseFare + distanceCharge,
                    charges.minimumFare
                ) + charges.bookingFee
            ).toFixed(2); // ride price

            rides.push({
                driverId: driver.id,
                type: driver.type[language].name,
                image: driver.type.image,
                capacity: driver.type.capacity,
                timeToArrival,
                price,
            });
        });

        res.json({ code: '1', message: req.t('success'), rides });
    } catch (error) {
        next(error);
    }
};

exports.bookRide = async (req, res, next) => {
    try {
        const {
            pickupLat,
            pickupLng,
            endLat,
            endLng,
            driverId,
            pickupAddress,
            endAddress,
        } = req.body;

        if (
            !pickupLat ||
            !pickupLng ||
            !endLat ||
            !endLng ||
            !pickupAddress ||
            !endAddress
        )
            return next(createError.BadRequest('Invalid addresses.'));

        // Check that the driver exists and is online
        const driver = await Driver.findById(driverId);
        if (!driver || driver.status !== 'online')
            return next(createError.BadRequest('Invalid driverId.'));

        const ride = await Ride.create({
            user: req.user.id,
            driver: driverId,
            pickupAddress: req.body.pickupAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            endAddress: req.body.endAddress,
            endLat: req.body.endLat,
            endLng: req.body.endLng,
        });

        // Notify the driver about the new ride request
        // notifyDriver(driver, ride);

        res.json({ code: '1', message: req.t('success'), ride });
    } catch (error) {
        if (error.name == 'CastError')
            return next(createError.BadRequest('Invalid driverId.'));
        next(error);
    }
};
