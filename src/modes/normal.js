module.exports = {
  name: "normal",
  description: "Sequential counting from 1",

  validate(currentNumber, providedNumber, position) {
    return providedNumber === currentNumber + 1;
  },

  getNext(currentNumber) {
    return currentNumber + 1;
  },

  getExpectedDescription(currentNumber) {
    return `${currentNumber + 1}`;
  },
};
