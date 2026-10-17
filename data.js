// MOCK DATA: stand-in for booking (PNR) and flight-inventory APIs. Times are minutes after midnight.
const m = (h, mi = 0) => h * 60 + mi;
const DEMO = {
  now: m(9, 45),                                   // simulated clock
  traveler: 'J. Rahman', ref: 'AX7K2Q',
  cancelled: { carrier: 'Air Canada', no: 'AC 408', dep: m(11) },
  windowMins: 120,                                 // "same time" = +/- 2h of original departure
  toDowntown: { YUL: 35, VIA: 10 },                // arrival hub to downtown Montreal
  from: {                                          // traveler at home, downtown Toronto
    YYZ: { name: 'Pearson', ground: 45, buffer: 90 },
    YTZ: { name: 'Billy Bishop', ground: 15, buffer: 45 },
    YHM: { name: 'Hamilton', ground: 60, buffer: 60 },
    VIA: { name: 'Union Station', ground: 15, buffer: 30 }
  },
  options: [
    { carrier: 'Air Canada', no: 'AC 412', from: 'YYZ', to: 'YUL', dep: m(11, 30), dur: 80, cost: 0,  change: 'free', seats: 5 },
    { carrier: 'Porter',     no: 'PD 2205', from: 'YTZ', to: 'YUL', dep: m(11, 45), dur: 80, cost: 45, change: 'fare', seats: 6 },
    { carrier: 'VIA Rail',   no: 'Train 59', from: 'VIA', to: 'VIA', dep: m(11, 15), dur: 300, cost: 89, change: 'new', seats: 20, rail: true },
    { carrier: 'Flair',      no: 'F8 1118', from: 'YHM', to: 'YUL', dep: m(12, 0),  dur: 80, cost: 38, change: 'new', seats: 2 },
    { carrier: 'Air Canada', no: 'AC 416', from: 'YYZ', to: 'YUL', dep: m(12, 15), dur: 80, cost: 0,  change: 'free', seats: 3 },
    { carrier: 'WestJet',    no: 'WS 6122', from: 'YYZ', to: 'YUL', dep: m(12, 50), dur: 85, cost: 60, change: 'new', seats: 8 },
    { carrier: 'Air Canada', no: 'AC 420', from: 'YYZ', to: 'YUL', dep: m(13, 40), dur: 80, cost: 0,  change: 'free', seats: 9 },
    { carrier: 'Porter',     no: 'PD 2211', from: 'YTZ', to: 'YUL', dep: m(14, 30), dur: 80, cost: 45, change: 'fare', seats: 11 }
  ]
};
