const ONLINE_COURSE_DATES = [
  {
    date: "14 July 2026",
    venue: "Live Online via Microsoft Teams",
    spaces: 10,
    price: 154
  },
  {
    date: "28 July 2026",
    venue: "Live Online via Microsoft Teams",
    spaces: 8,
    price: 154
  }
];

const CLASSROOM_COURSE_DATES = [
  {
    date: "21 July 2026",
    venue: "West Thames College",
    spaces: 12,
    price: 154
  },
  {
    date: "4 August 2026",
    venue: "West Thames College",
    spaces: 10,
    price: 154
  }
];

const COURSE_DATES = [
  ...ONLINE_COURSE_DATES.map((item) => ({ ...item, type: "Online" })),
  ...CLASSROOM_COURSE_DATES.map((item) => ({ ...item, type: "Classroom" }))
];
