const { evaluate } = require("mathjs");

function verifyNumber(input, expectedNumber) {
  try {
    const cleanInput = input.trim();

    if (/^[01]+$/.test(cleanInput)) {
      const decimalValue = parseInt(cleanInput, 2);
      const asDecimal = parseInt(cleanInput, 10);
      if (asDecimal === expectedNumber + 1) {
        return {
          isValid: true,
          value: asDecimal,
          expression: null,
        };
      }

      return {
        isValid: true,
        value: decimalValue,
        expression: cleanInput,
      };
    }

    const result = evaluate(cleanInput);

    if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
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
