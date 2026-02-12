var last_unix = 0;

function updateUnix() {
  let unix = Math.floor(Date.now() / 1000);
  if (last_unix != unix) {
    last_unix = unix;
    document.getElementById("unix").innerText = unix;
    document.getElementById("factors").innerHTML = formatPrimeFactors(primeFactors(unix));
  }
}

function primeFactors(n) {
  const factors = [];
  for (let i = 2; i ** 2 <= n; i == 2 ? (i = 3) : (i += 2)) {
    while (n % i === 0) {
      factors.push(i);
      n /= i;
    }
  }
  if (n > 2) {
    factors.push(n);
  }
  return factors;
}

function formatPrimeFactors(primeFactors) {
  const factorCounts = {};
  primeFactors.forEach((factor) => {
    factorCounts[factor] = (factorCounts[factor] || 0) + 1;
  });
  const formattedFactors = Object.entries(factorCounts)
    .map(([factor, count]) => {
      if (count === 1) {
        return factor;
      } else {
        return `${factor}<sup>${count}</sup>`;
      }
    })
    .join(" &times; ");
  return formattedFactors;
}

window.onload = updateUnix;
window.setInterval(updateUnix, 1);
