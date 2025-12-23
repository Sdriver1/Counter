const { evaluate } = require('mathjs');

function verifyNumber(input, expectedNumber) {
    try {
        const cleanInput = input.trim();
        const result = evaluate(cleanInput);
        
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            const roundedValue = Math.round(result);
            
            return {
                isValid: true,
                value: roundedValue,
                expression: cleanInput !== roundedValue.toString() ? cleanInput : null
            };
        }
        
        return { isValid: false, value: null, expression: null };
    } catch (error) {
        return { isValid: false, value: null, expression: null };
    }
}

module.exports = { verifyNumber };
