module.exports = length => {
    const digits = '0123456789';
    let generated = '';
    for (let i = 0; i < length; i++)
        generated += digits[Math.floor(Math.random() * digits.length)];
    return generated;
};
