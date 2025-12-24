function isPrime(num) {
  if (num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;

  const sqrt = Math.sqrt(num);
  for (let i = 3; i <= sqrt; i += 2) {
    if (num % i === 0) return false;
  }
  return true;
}

function getNextPrime(num) {
  let candidate = num + 1;
  while (!isPrime(candidate)) {
    candidate++;
    if (candidate > 1000000) {
      return candidate;
    }
  }
  return candidate;
}

module.exports = {
  name: "prime",
  description: "Prime numbers only (2, 3, 5, 7, 11, 13...)",

  validate(currentNumber, providedNumber, position) {
    if (currentNumber === 0) {
      return providedNumber === 2;
    }

    if (!isPrime(providedNumber)) {
      return false;
    }

    const nextPrime = getNextPrime(currentNumber);
    return providedNumber === nextPrime;
  },

  getNext(currentNumber) {
    if (currentNumber === 0) return 2;
    return getNextPrime(currentNumber);
  },

  getExpectedDescription(currentNumber) {
    return `${this.getNext(currentNumber)} (Prime)`;
  },
};
