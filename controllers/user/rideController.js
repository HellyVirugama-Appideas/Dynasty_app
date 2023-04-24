const geolib = require('geolib');
const createError = require('http-errors');

const Driver = require('../../models/driverModel');
const Charges = require('../../models/chargesModel');

// TODO: only 'online' driver and there type is in ['taxi', 'bike']
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
        const [drivers, charges] = await Promise.all([
            Driver.find({
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
