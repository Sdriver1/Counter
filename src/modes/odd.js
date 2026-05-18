module.exports = {
  getNext(currentNumber) {
    return currentNumber === 0 ? 1 : currentNumber + 2;
  },
  validate(currentNumber, value) {
    return value === this.getNext(currentNumber);
  },
  getExpectedDescription(currentNumber) {
    return this.getNext(currentNumber).toString();
  },
  disableMath: false,
};
