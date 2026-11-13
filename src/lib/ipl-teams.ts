export const IPL_TEAMS = [
  {
    "code": "CSK",
    "name": "Chennai Super Kings",
    "color": "#f5b301"
  },
  {
    "code": "MI",
    "name": "Mumbai Indians",
    "color": "#168bdf"
  },
  {
    "code": "RCB",
    "name": "Royal Challengers Bengaluru",
    "color": "#ef4444"
  },
  {
    "code": "KKR",
    "name": "Kolkata Knight Riders",
    "color": "#a855f7"
  },
  {
    "code": "DC",
    "name": "Delhi Capitals",
    "color": "#3b82f6"
  },
  {
    "code": "PBKS",
    "name": "Punjab Kings",
    "color": "#f43f5e"
  },
  {
    "code": "RR",
    "name": "Rajasthan Royals",
    "color": "#ec4899"
  },
  {
    "code": "SRH",
    "name": "Sunrisers Hyderabad",
    "color": "#f97316"
  },
  {
    "code": "LSG",
    "name": "Lucknow Super Giants",
    "color": "#22d3ee"
  },
  {
    "code": "GT",
    "name": "Gujarat Titans",
    "color": "#94a3b8"
  }
] as const;
export type IplTeamCode = typeof IPL_TEAMS[number]["code"];
