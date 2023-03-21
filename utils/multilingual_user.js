module.exports = (user, req) => {
    const accepted = ['en', 'ar'];
    user = user._doc;
    let language = accepted.includes(req.headers['accept-language'])
        ? req.headers['accept-language']
        : 'en';
    if (language == 'ar') {
        user.country = user.country?.ar?.name;
        user.city = user.city?.ar?.name;
    } else {
        user.country = user.country?.en?.name;
        user.city = user.city?.en?.name;
    }
    return user;
};
