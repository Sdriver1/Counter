const fibCache = new Map();

function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1 || n === 2) return 1;

  if (fibCache.has(n)) {
    return fibCache.get(n);
  }

  const result = fibonacci(n - 1) + fibonacci(n - 2);
  fibCache.set(n, result);
  return result;
}

function findFibPosition(num) {
  let pos = 1;
  while (true) {
    const fib = fibonacci(pos);
    if (fib === num) return pos;
    if (fib > num) return null;
    pos++;
    if (pos > 100) return null;
  }
}

module.exports = {
  name: "fibonacci",
  description: "Fibonacci sequence counting (1, 1, 2, 3, 5, 8, 13...)",

  validate(currentNumber, providedNumber, position) {
    const nextFib = fibonacci(position + 1);
    return providedNumber === nextFib;
  },

  getNext(currentNumber) {
    if (currentNumber === 0) return 1;

    const currentPos = findFibPosition(currentNumber);
    if (currentPos === null) return 1;

    return fibonacci(currentPos + 1);
  },

  getExpectedDescription(currentNumber) {
    return `${this.getNext(currentNumber)} (Fibonacci)`;
  },
};
