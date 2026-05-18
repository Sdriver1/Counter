module.exports = {
  getNext(currentNumber) {
    if (currentNumber === 0) return 1;
    const n = Math.round(Math.sqrt(currentNumber));
    return (n + 1) ** 2;
  },
  validate(currentNumber, value) {
    return value === this.getNext(currentNumber);
  },
  getExpectedDescription(currentNumber) {
    return this.getNext(currentNumber).toString();
  },
  disableMath: false,
};
