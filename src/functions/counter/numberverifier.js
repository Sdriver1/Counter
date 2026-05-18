const { create, all } = require('mathjs');

const MAX_INPUT_LENGTH = 100;
const BLOCKED_PATTERN = /(\d+\s*\^\s*){3,}/;

const limitedMath = create(all, { number: 'number' });
limitedMath.import({
  import:     function () { throw new Error('disabled'); },
  createUnit: function () { throw new Error('disabled'); },
  simplify:   function () { throw new Error('disabled'); },
  derivative: function () { throw new Error('disabled'); },
}, { override: true });

const safeEvaluate = limitedMath.evaluate.bind(limitedMath);

function verifyNumber(input, expectedNumber) {
  try {
    const cleanInput = input.trim();

    if (cleanInput.length > MAX_INPUT_LENGTH) {
      return { isValid: false, value: null, expression: null };
    }

    if (BLOCKED_PATTERN.test(cleanInput)) {
      return { isValid: false, value: null, expression: null };
    }

    if (/^[01]+$/.test(cleanInput)) {
      const asDecimal = parseInt(cleanInput, 10);
      if (asDecimal === expectedNumber) {
        return { isValid: true, value: asDecimal, expression: null };
      }
      const decimalValue = parseInt(cleanInput, 2);
      return { isValid: true, value: decimalValue, expression: cleanInput };
    }

    const result = safeEvaluate(cleanInput);

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      const roundedValue = Math.round(result);
      return {
        isValid: true,
        value: roundedValue,
        expression: cleanInput !== roundedValue.toString() ? cleanInput : null,
      };
    }

    return { isValid: false, value: null, expression: null };
  } catch (error) {
    return { isValid: false, value: null, expression: null };
  }
}

module.exports = { verifyNumber };
